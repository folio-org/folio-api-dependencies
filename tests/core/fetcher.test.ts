import { describe, it, expect } from 'vitest'
import { MockFetcher } from '../helpers/MockFetcher'

describe('MockFetcher', () => {
  it('returns the registered fixture for a url', async () => {
    const fetcher = new MockFetcher({ '/data/test.json': { hello: 'world' } })
    const result = await fetcher.fetchJson<{ hello: string }>('/data/test.json')
    expect(result).toEqual({ hello: 'world' })
  })

  it('throws when no fixture is registered for a url', async () => {
    const fetcher = new MockFetcher({})
    await expect(fetcher.fetchJson('/missing.json')).rejects.toThrow(
      'MockFetcher: no fixture registered for "/missing.json"'
    )
  })
})
