import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { GitHubClient, type Repo } from './github-client'
import type { ModuleMap } from '../types/index'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_FILE = path.join(__dirname, '..', '..', 'public', 'data', 'dependencies.json')
const MOD_FILE_CANDIDATES = [
  'descriptors/ModuleDescriptor-template.json',
  'service/src/main/okapi/ModuleDescriptor-template.json',
]

const client = new GitHubClient(process.env.GH_TOKEN)

async function tryFetchDescriptor(repo: Repo): Promise<Record<string, unknown> | null> {
  console.log(`Repo: ${repo.name}, branch: ${repo.default_branch}`)
  if (repo.archived) { console.log(`Skipping archived: ${repo.name}`); return null }
  if (repo.name.startsWith('mod-') || repo.name.startsWith('edge-')) {
    for (const candidate of MOD_FILE_CANDIDATES) {
      const data = await client.getRawJson<Record<string, unknown>>(repo.name, repo.default_branch, candidate)
      if (data) return data
    }
  } else if (repo.name.startsWith('ui-') || repo.name.startsWith('stripes-')) {
    return client.getRawJson<Record<string, unknown>>(repo.name, repo.default_branch, 'package.json')
  }
  return null
}

async function buildDependencyMap(): Promise<ModuleMap> {
  const repos = await client.listOrgRepos()
  const map: ModuleMap = {}
  for (const repo of repos) {
    const descriptor = await tryFetchDescriptor(repo)
    if (!descriptor) continue
    const id = repo.name
    if (id.startsWith('mod-') || id.startsWith('edge-')) {
      map[id] = {
        provides: ((descriptor.provides as any[]) ?? []).map((p: any) => ({ id: p.id, version: p.version || '' })),
        requires: ((descriptor.requires as any[]) ?? []).flatMap((r: any) =>
          (r.version || '').split(' ').map((v: string) => ({ id: r.id, version: v }))
        ),
        optional: ((descriptor.optional as any[]) ?? []).flatMap((o: any) =>
          (o.version || '').split(' ').map((v: string) => ({ id: o.id, version: v }))
        ),
      }
    } else if (id.startsWith('ui-') || id.startsWith('stripes-')) {
      const stripes = (descriptor.stripes as any) ?? {}
      map[id] = {
        provides: [],
        requires: Object.entries(stripes.okapiInterfaces ?? {}).flatMap(([apiId, versions]) =>
          String(versions).split(' ').map(v => ({ id: apiId, version: v }))
        ),
        optional: Object.entries(stripes.optionalOkapiInterfaces ?? {}).flatMap(([apiId, versions]) =>
          String(versions).split(' ').map(v => ({ id: apiId, version: v }))
        ),
      }
    }
  }
  return map
}

async function main(): Promise<void> {
  console.log('Fetching FOLIO dependencies...')
  const map = await buildDependencyMap()
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(map, null, 2))
  console.log(`Saved to ${OUTPUT_FILE}`)
}

main().catch(err => { console.error('Error:', err.message); process.exit(1) })
