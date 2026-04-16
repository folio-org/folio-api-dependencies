import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { GitHubClient, type Repo } from './github-client'
import type { AppsMap } from '../types/index'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_FILE = path.join(__dirname, '..', '..', 'public', 'data', 'apps.json')
const SNAPSHOT_BRANCH = 'snapshot'

const client = new GitHubClient(process.env.GH_TOKEN)

async function tryFetchAppDescriptor(repo: Repo): Promise<Record<string, unknown> | null> {
  if (repo.archived || !repo.name.startsWith('app-') || repo.name === 'app-platform-full') return null
  return client.getRawJson<Record<string, unknown>>(repo.name, SNAPSHOT_BRANCH, `${repo.name}.template.json`)
}

async function buildAppMap(): Promise<AppsMap> {
  const repos = await client.listOrgRepos()
  const map: AppsMap = {}
  for (const repo of repos) {
    const descriptor = await tryFetchAppDescriptor(repo)
    if (!descriptor) continue
    map[repo.name] = {
      platform: String(descriptor.platform ?? ''),
      modules: ((descriptor.modules as any[]) ?? []).map((m: any) => ({ name: m.name, version: m.version })),
      uiModules: ((descriptor.uiModules as any[]) ?? []).map((m: any) => ({ name: m.name, version: m.version })),
      dependencies: ((descriptor.dependencies as any[]) ?? []).map((d: any) => ({ name: d.name, version: d.version })),
    }
  }
  return map
}

async function main(): Promise<void> {
  console.log('Fetching FOLIO apps...')
  const map = await buildAppMap()
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(map, null, 2))
  console.log(`Saved to ${OUTPUT_FILE}`)
}

main().catch(err => { console.error('Error:', err.message); process.exit(1) })
