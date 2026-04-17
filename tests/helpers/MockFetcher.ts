import type { Fetcher } from '../../src/core/fetcher'

export class MockFetcher implements Fetcher {
  constructor(private fixtures: Record<string, unknown>) {}

  async fetchJson<T>(url: string): Promise<T> {
    if (!(url in this.fixtures)) {
      throw new Error(`MockFetcher: no fixture registered for "${url}"`)
    }
    return this.fixtures[url] as T
  }
}
