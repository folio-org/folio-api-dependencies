import { HttpFetcher } from './core/fetcher'
import { AppStore } from './store/AppStore'
import { DataManager } from './managers/DataManager'
import { DependencyAnalyzer } from './core/dependency-analyzer'
import { TableManager } from './managers/TableManager'
import { ApiManager } from './managers/ApiManager'
import { AppsManager } from './managers/AppsManager'
import { AppDependenciesGraphManager } from './managers/GraphManager'
import { ModuleConsumersGraphManager } from './managers/ModuleConsumersGraphManager'
import { DropdownComponent } from './core/dropdown'
import { debounce, getQueryParam } from './core/utils'

async function init(): Promise<void> {
  const fetcher = new HttpFetcher()
  const store = new AppStore()
  const dataManager = new DataManager(fetcher, store)
  await dataManager.load()

  const analyzer = new DependencyAnalyzer()
  store.setRemovableDeps(analyzer.analyze(store.getApps(), store.getModules()))

  // Table
  const tbody = document.querySelector<HTMLTableSectionElement>('#dependency-table tbody')!
  const tableManager = new TableManager(store, tbody, mod => dataManager.getAppsForModule(mod))
  tableManager.renderTable(store.getRows())

  // Table search
  const tableSearchInput = document.getElementById('table-search') as HTMLInputElement
  const tableDropdownEl = document.getElementById('table-dropdown') as HTMLElement
  const tableItems = [
    ...new Set(store.getRows().map(r => r.module)),
    ...new Set(store.getRows().map(r => r.api)),
  ].sort()
  const tableDropdown = new DropdownComponent(tableSearchInput, tableDropdownEl, {
    onSelect: term => tableManager.filterTable(term),
  })
  tableDropdown.setItems(tableItems)
  tableDropdown.init()
  tableSearchInput.addEventListener('input', debounce(() => tableManager.filterTable(tableSearchInput.value), 200))
  document.getElementById('table-clear')?.addEventListener('click', () => {
    tableSearchInput.value = ''; tableManager.filterTable('')
  })
  document.getElementById('export-table-csv')?.addEventListener('click', () => tableManager.exportToCSV())

  // Column sorting
  document.querySelectorAll<HTMLElement>('th[data-sort]').forEach(th => {
    let ascending = true
    th.addEventListener('click', () => {
      tableManager.sortBy(th.dataset.sort as 'module' | 'type' | 'api', ascending)
      ascending = !ascending
    })
  })

  // API view
  const apiContainer = document.getElementById('api-details') as HTMLElement
  const apiManager = new ApiManager(store, apiContainer)
  const apiInput = document.getElementById('api-select') as HTMLInputElement
  const apiDropdownEl = document.getElementById('api-dropdown') as HTMLElement
  const apiDropdown = new DropdownComponent(apiInput, apiDropdownEl, {
    filterFn: (items, term) => items.filter(i => i.startsWith(term)),
    onSelect: api => apiManager.selectApi(api),
  })
  apiDropdown.setItems([...store.getApiIndex().keys()].sort())
  apiDropdown.init()
  ;(window as any).selectApi = (api: string) => apiManager.selectApi(api)

  // Apps view
  const appsContainer = document.getElementById('apps-container') as HTMLElement
  const appsManager = new AppsManager(appsContainer)
  appsManager.init(store.getApps(), store.getRemovableDeps())
  const appSearchInput = document.getElementById('app-search') as HTMLInputElement
  appSearchInput.addEventListener('input', debounce(() => appsManager.filter(appSearchInput.value), 200))
  document.getElementById('app-clear')?.addEventListener('click', () => {
    appSearchInput.value = ''; appsManager.filter('')
  })

  // Module consumers graph
  const moduleInput = document.getElementById('module-consumers-input') as HTMLInputElement
  const moduleDropdownEl = document.getElementById('module-consumers-dropdown') as HTMLElement
  const moduleGraphContainer = document.getElementById('module-consumers-graph') as HTMLElement
  const moduleGraphManager = new ModuleConsumersGraphManager(store)
  moduleGraphManager.init(moduleInput, moduleDropdownEl)
  moduleGraphManager.initGraph(moduleGraphContainer)
  document.getElementById('reset-graph')?.addEventListener('click', () => moduleGraphManager.clearGraph())
  document.getElementById('export-graph')?.addEventListener('click', () => moduleGraphManager.exportGraph())
  document.getElementById('deselect-mode')?.addEventListener('click', () => {
    moduleGraphManager.toggleDeselectMode()
    const btn = document.getElementById('deselect-mode') as HTMLElement
    btn.style.backgroundColor = moduleGraphManager.isDeselectMode() ? '#e74c3c' : ''
  })

  // App dependencies graph (lazy init on tab click)
  const appGraphManager = new AppDependenciesGraphManager()
  let appGraphInitialized = false
  document.querySelector('[data-tab="app-deps"]')?.addEventListener('click', () => {
    if (!appGraphInitialized) {
      appGraphInitialized = true
      setTimeout(() => appGraphManager.init(store.getApps()), 100)
    }
  })

  // Tabs
  document.querySelectorAll<HTMLElement>('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'))
      document.querySelectorAll<HTMLElement>('[id^="view-"]').forEach(v => { v.style.display = 'none' })
      btn.classList.add('active')
      const view = document.getElementById(`view-${btn.dataset.tab}`)
      if (view) view.style.display = ''
    })
  })

  // Deep-link: ?api=xxx
  const initialApi = getQueryParam('api')
  if (initialApi) {
    document.querySelector<HTMLElement>('[data-tab="api"]')?.click()
    setTimeout(() => apiManager.selectApi(initialApi), 100)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => console.error('App init failed:', err))
})
