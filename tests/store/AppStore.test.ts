import { describe, it, expect, beforeEach } from 'vitest'
import { AppStore } from '../../src/store/AppStore'
import type { ModuleMap, AppsMap, DependencyRow, RemovableDepsMap, ApiIndex } from '../../src/types/index'

describe('AppStore', () => {
  let store: AppStore

  beforeEach(() => {
    store = new AppStore()
  })

  it('starts with empty modules', () => {
    expect(store.getModules()).toEqual({})
  })

  it('stores and retrieves modules', () => {
    const modules: ModuleMap = {
      'mod-foo': { provides: [], requires: [], optional: [] },
    }
    store.setModules(modules)
    expect(store.getModules()).toEqual(modules)
  })

  it('stores and retrieves apps', () => {
    const apps: AppsMap = {
      'app-foo': { platform: 'base', modules: [], uiModules: [], dependencies: [] },
    }
    store.setApps(apps)
    expect(store.getApps()).toEqual(apps)
  })

  it('stores and retrieves rows', () => {
    const rows: DependencyRow[] = [
      { module: 'mod-foo', type: 'provides', api: 'foo-api', version: '1.0' },
    ]
    store.setRows(rows)
    expect(store.getRows()).toEqual(rows)
  })

  it('stores and retrieves removable deps', () => {
    const map: RemovableDepsMap = new Map([['app-foo', new Set(['app-bar'])]])
    store.setRemovableDeps(map)
    expect(store.getRemovableDeps()).toBe(map)
  })

  it('stores and retrieves api index', () => {
    const index: ApiIndex = new Map([
      ['foo-api', { provides: [], requires: [], optional: [] }],
    ])
    store.setApiIndex(index)
    expect(store.getApiIndex()).toBe(index)
  })

  it('stores and retrieves module-to-apps map', () => {
    const map = new Map([['mod-foo', ['app-foo']]])
    store.setModuleToAppsMap(map)
    expect(store.getModuleToAppsMap()).toBe(map)
  })
})
