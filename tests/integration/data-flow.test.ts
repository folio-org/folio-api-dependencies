import { describe, it, expect } from 'vitest'
import { DataManager } from '../../src/managers/DataManager'
import { DependencyAnalyzer } from '../../src/core/dependency-analyzer'
import { AppStore } from '../../src/store/AppStore'
import { MockFetcher } from '../helpers/MockFetcher'

const modulesFixture = (await import('../fixtures/dependencies.fixture.json')).default
const appsFixture = (await import('../fixtures/apps.fixture.json')).default

describe('data flow integration', () => {
  it('loads data, builds index, and analyzer correctly identifies removable deps', async () => {
    const store = new AppStore()
    const fetcher = new MockFetcher({
      '/data/dependencies.json': modulesFixture,
      '/data/apps.json': appsFixture,
    })
    const dataManager = new DataManager(fetcher, store)
    await dataManager.load()

    const analyzer = new DependencyAnalyzer()
    const removable = analyzer.analyze(store.getApps(), store.getModules())

    expect(removable.get('app-inventory')).toContain('app-users')
    expect(removable.has('app-users')).toBe(false)

    const inventoryEntry = store.getApiIndex().get('inventory')
    expect(inventoryEntry).toBeDefined()
    expect(inventoryEntry?.provides.some(r => r.module === 'mod-inventory')).toBe(true)
  })
})
