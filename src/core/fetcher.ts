export interface Fetcher {
  fetchJson<T>(url: string): Promise<T>
}

export class HttpFetcher implements Fetcher {
  async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Failed to fetch "${url}": HTTP ${res.status}`)
    }
    return res.json() as Promise<T>
  }
}
