import fetch from 'node-fetch'

export interface Repo {
  name: string
  default_branch: string
  archived: boolean
}

const ORG = 'folio-org'
const GITHUB_API = 'https://api.github.com'
const RAW_BASE = 'https://raw.githubusercontent.com'

export class GitHubClient {
  private headers: Record<string, string>

  constructor(token?: string) {
    this.headers = {
      'User-Agent': 'folio-dependency-graph',
      ...(token ? { Authorization: `token ${token}` } : {}),
    }
  }

  async listOrgRepos(): Promise<Repo[]> {
    let page = 1
    const repos: Repo[] = []
    while (true) {
      const url = `${GITHUB_API}/orgs/${ORG}/repos?per_page=100&page=${page}`
      const res = await fetch(url, { headers: this.headers })
      if (!res.ok) throw new Error(`Failed to list repos: ${res.status}`)
      const pageRepos = (await res.json()) as Repo[]
      if (pageRepos.length === 0) break
      repos.push(...pageRepos)
      page++
    }
    return repos
  }

  async getRawJson<T>(repoName: string, branch: string, filePath: string): Promise<T | null> {
    const url = `${RAW_BASE}/${ORG}/${repoName}/${branch}/${filePath}`
    const res = await fetch(url, { headers: this.headers })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
    return res.json() as Promise<T>
  }
}
