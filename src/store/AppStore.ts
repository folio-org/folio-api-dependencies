import type { ModuleMap, AppsMap, DependencyRow, RemovableDepsMap, ApiIndex } from '../types/index'

export class AppStore {
  private modules: ModuleMap = {}
  private apps: AppsMap = {}
  private rows: DependencyRow[] = []
  private removableDeps: RemovableDepsMap = new Map()
  private apiIndex: ApiIndex = new Map()
  private moduleToAppsMap: Map<string, string[]> = new Map()

  getModules(): ModuleMap { return this.modules }
  setModules(data: ModuleMap): void { this.modules = data }

  getApps(): AppsMap { return this.apps }
  setApps(data: AppsMap): void { this.apps = data }

  getRows(): DependencyRow[] { return this.rows }
  setRows(rows: DependencyRow[]): void { this.rows = rows }

  getRemovableDeps(): RemovableDepsMap { return this.removableDeps }
  setRemovableDeps(map: RemovableDepsMap): void { this.removableDeps = map }

  getApiIndex(): ApiIndex { return this.apiIndex }
  setApiIndex(index: ApiIndex): void { this.apiIndex = index }

  getModuleToAppsMap(): Map<string, string[]> { return this.moduleToAppsMap }
  setModuleToAppsMap(map: Map<string, string[]>): void { this.moduleToAppsMap = map }
}
