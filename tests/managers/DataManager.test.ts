import { describe, it, expect, beforeEach } from 'vitest'
import { DataManager } from '../../src/managers/DataManager'
import { AppStore } from '../../src/store/AppStore'
import { MockFetcher } from '../helpers/MockFetcher'
import type { ModuleMap, AppsMap } from '../../src/types/index'

const modulesFixture: ModuleMap = {
  'mod-foo': {
    provides: [{ id: 'foo-api', version: '1.0' }],
    requires: [{ id: 'bar-api', version: '2.0' }],
    optional: [],
  },
  'ui-baz': {
    provides: [],
    requires: [{ id: 'foo-api', version: '1.0' }],
    optional: [{ id: 'bar-api', version: '2.0' }],
  },
}

const appsFixture: AppsMap = {
  'app-alpha': {
    platform: 'base',
    modules: [{ name: 'mod-foo', version: '1.0.0' }],
    uiModules: [{ name: 'ui-baz', version: '1.0.0' }],
    dependencies: [],
  },
}

describe('DataManager', () => {
  let store: AppStore
  let fetcher: MockFetcher
  let manager: DataManager

  beforeEach(() => {
    store = new AppStore()
    fetcher = new MockFetcher({
      '/data/dependencies.json': modulesFixture,
      '/data/apps.json': appsFixture,
    })
    manager = new DataManager(fetcher, store)
  })

  it('loads modules and apps in a single call', async () => {
    await manager.load()
    expect(store.getModules()).toEqual(modulesFixture)
    expect(store.getApps()).toEqual(appsFixture)
  })

  it('processData returns flat dependency rows for all relationship types', async () => {
    await manager.load()
    const rows = store.getRows()
    expect(rows.some(r => r.module === 'mod-foo' && r.type === 'provides' && r.api === 'foo-api')).toBe(true)
    expect(rows.some(r => r.module === 'mod-foo' && r.type === 'requires' && r.api === 'bar-api')).toBe(true)
    expect(rows.some(r => r.module === 'ui-baz' && r.type === 'optional' && r.api === 'bar-api')).toBe(true)
  })

  it('buildApiIndex maps each api to its providers and consumers', async () => {
    await manager.load()
    const index = store.getApiIndex()
    const fooEntry = index.get('foo-api')
    expect(fooEntry).toBeDefined()
    expect(fooEntry?.provides.some(r => r.module === 'mod-foo')).toBe(true)
    expect(fooEntry?.requires.some(r => r.module === 'ui-baz')).toBe(true)
  })

  it('buildModuleToAppsMap maps backend modules to app names', async () => {
    await manager.load()
    expect(store.getModuleToAppsMap().get('mod-foo')).toContain('app-alpha')
  })

  it('buildModuleToAppsMap maps ui modules to app names', async () => {
    await manager.load()
    expect(store.getModuleToAppsMap().get('ui-baz')).toContain('app-alpha')
  })
})
