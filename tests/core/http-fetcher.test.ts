import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpFetcher } from '../../src/core/fetcher'

describe('HttpFetcher', () => {
  let fetcher: HttpFetcher

  beforeEach(() => {
    fetcher = new HttpFetcher()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed JSON on successful fetch', async () => {
    const mockData = { key: 'value' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    }))
    const result = await fetcher.fetchJson('/data.json')
    expect(result).toEqual(mockData)
  })

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }))
    await expect(fetcher.fetchJson('/missing.json')).rejects.toThrow('HTTP 404')
  })
})
