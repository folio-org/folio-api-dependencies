import type { ModuleMap, AppsMap, RemovableDepsMap } from '../types/index'

export class DependencyAnalyzer {
  analyze(appsData: AppsMap, modulesRaw: ModuleMap): RemovableDepsMap {
    const result: RemovableDepsMap = new Map()
    const appProvides = this.buildAppApiSet(appsData, modulesRaw, 'provides')
    const appRequires = this.buildAppApiSet(appsData, modulesRaw, 'requires')

    for (const [appName, appData] of Object.entries(appsData)) {
      const removable = new Set<string>()
      for (const dep of appData.dependencies) {
        const depProvides = appProvides.get(dep.name)
        if (!depProvides || depProvides.size === 0) continue
        const appHardRequires = appRequires.get(appName) ?? new Set()
        const hasHardOverlap = [...depProvides].some(api => appHardRequires.has(api))
        if (!hasHardOverlap) removable.add(dep.name)
      }
      if (removable.size > 0) result.set(appName, removable)
    }

    return result
  }

  private buildAppApiSet(
    appsData: AppsMap,
    modulesRaw: ModuleMap,
    side: 'provides' | 'requires' | 'optional'
  ): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>()
    for (const [appName, appData] of Object.entries(appsData)) {
      const apis = new Set<string>()
      const allModules = [...(appData.modules ?? []), ...(appData.uiModules ?? [])]
      for (const mod of allModules) {
        for (const name of this.uiModuleCandidates(mod.name)) {
          for (const entry of (modulesRaw[name]?.[side] ?? [])) {
            apis.add(entry.id)
          }
        }
      }
      map.set(appName, apis)
    }
    return map
  }

  private uiModuleCandidates(rawName: string): string[] {
    const normalized = rawName.replace(/^folio_/, '').replace(/_/g, '-')
    return [rawName, `ui-${normalized}`, `stripes-${normalized}`]
  }
}
