import type { AppStore } from '../store/AppStore'
import type { DependencyRow } from '../types/index'
import { downloadCSV } from '../core/utils'

type ModuleLookupFn = (moduleName: string) => string[]

export class TableManager {
  private groupedRows: Map<string, string[]> = new Map()

  constructor(
    private store: AppStore,
    private tbody: HTMLTableSectionElement,
    private getAppsForModule: ModuleLookupFn
  ) {}

  renderTable(rows: DependencyRow[]): void {
    this.groupedRows = this.buildGroupedRows(rows)
    this.tbody.innerHTML = ''
    const fragment = document.createDocumentFragment()
    for (const [key, versions] of this.groupedRows) {
      const [module, type, api] = key.split('|')
      const tr = document.createElement('tr')
      tr.dataset.module = module
      tr.dataset.type = type
      tr.dataset.api = api
      tr.innerHTML = `<td>${module}</td><td>${type}</td><td>${api}</td><td>${versions.join(', ')}</td>`
      fragment.appendChild(tr)
    }
    this.tbody.appendChild(fragment)
  }

  buildGroupedRows(rows: DependencyRow[]): Map<string, string[]> {
    const map = new Map<string, string[]>()
    for (const row of rows) {
      const key = `${row.module}|${row.type}|${row.api}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row.version)
    }
    return map
  }

  filterTable(term: string): void {
    const lower = term.toLowerCase()
    this.tbody.querySelectorAll<HTMLElement>('tr').forEach(tr => {
      const matches =
        (tr.dataset.module ?? '').toLowerCase().includes(lower) ||
        (tr.dataset.api ?? '').toLowerCase().includes(lower)
      tr.style.display = matches ? '' : 'none'
    })
  }

  sortBy(column: 'module' | 'type' | 'api', ascending = true): void {
    const rows = Array.from(this.tbody.querySelectorAll<HTMLElement>('tr'))
    rows.sort((a, b) => {
      const av = a.dataset[column] ?? ''
      const bv = b.dataset[column] ?? ''
      return ascending ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    rows.forEach(r => this.tbody.appendChild(r))
  }

  exportToCSV(): void {
    const header = ['Module', 'Type', 'API', 'Version']
    const dataRows: string[][] = []
    for (const [key, versions] of this.groupedRows) {
      const [module, type, api] = key.split('|')
      dataRows.push([module, type, api, versions.join(' ')])
    }
    downloadCSV('dependencies.csv', [header, ...dataRows])
  }
}
