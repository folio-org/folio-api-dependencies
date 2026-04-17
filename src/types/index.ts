export interface ApiDescriptor {
  id: string
  version: string
}

export interface ModuleDescriptor {
  provides: ApiDescriptor[]
  requires: ApiDescriptor[]
  optional: ApiDescriptor[]
}

export type ModuleMap = Record<string, ModuleDescriptor>

export interface AppDescriptor {
  platform: string
  modules: { name: string; version: string }[]
  uiModules: { name: string; version: string }[]
  dependencies: { name: string; version: string }[]
}

export type AppsMap = Record<string, AppDescriptor>

export interface DependencyRow {
  module: string
  type: 'provides' | 'requires' | 'optional'
  api: string
  version: string
}

export type RemovableDepsMap = Map<string, Set<string>>

export interface ApiIndexEntry {
  provides: DependencyRow[]
  requires: DependencyRow[]
  optional: DependencyRow[]
}

export type ApiIndex = Map<string, ApiIndexEntry>
