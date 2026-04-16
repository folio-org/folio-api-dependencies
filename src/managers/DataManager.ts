import type { Fetcher } from '../core/fetcher'
import type { AppStore } from '../store/AppStore'
import type { ModuleMap, AppsMap, DependencyRow, ApiIndex, ApiIndexEntry } from '../types/index'

export class DataManager {
  constructor(private fetcher: Fetcher, private store: AppStore) {}

  async load(): Promise<void> {
    const [modules, apps] = await Promise.all([
      this.fetcher.fetchJson<ModuleMap>('/data/dependencies.json'),
      this.fetcher.fetchJson<AppsMap>('/data/apps.json'),
    ])
    this.store.setModules(modules)
    this.store.setApps(apps)

    const rows = this.processData(modules)
    this.store.setRows(rows)
    this.store.setApiIndex(this.buildApiIndex(rows))
    this.store.setModuleToAppsMap(this.buildModuleToAppsMap(apps))
  }

  getAppsForModule(moduleName: string): string[] {
    return this.store.getModuleToAppsMap().get(moduleName) ?? []
  }

  private processData(data: ModuleMap): DependencyRow[] {
    const rows: DependencyRow[] = []
    for (const [moduleId, descriptor] of Object.entries(data)) {
      for (const type of ['provides', 'requires', 'optional'] as const) {
        for (const entry of descriptor[type] ?? []) {
          rows.push({ module: moduleId, type, api: entry.id, version: entry.version })
        }
      }
    }
    return rows
  }

  private buildApiIndex(rows: DependencyRow[]): ApiIndex {
    const index: ApiIndex = new Map()
    for (const row of rows) {
      if (!index.has(row.api)) {
        index.set(row.api, { provides: [], requires: [], optional: [] })
      }
      const entry = index.get(row.api) as ApiIndexEntry
      entry[row.type].push(row)
    }
    return index
  }

  private buildModuleToAppsMap(appsData: AppsMap): Map<string, string[]> {
    const map = new Map<string, string[]>()
    const add = (name: string, appName: string) => {
      if (!map.has(name)) map.set(name, [])
      map.get(name)!.push(appName)
    }
    for (const [appName, appData] of Object.entries(appsData)) {
      for (const mod of appData.modules ?? []) add(mod.name, appName)
      for (const uiMod of appData.uiModules ?? []) {
        const normalized = uiMod.name.replace(/^folio_/, '').replace(/_/g, '-')
        add(uiMod.name, appName)
        add(`ui-${normalized}`, appName)
        add(`stripes-${normalized}`, appName)
      }
    }
    return map
  }
}
