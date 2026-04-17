import type { AppStore } from '../store/AppStore'
import type { DependencyRow } from '../types/index'
import { downloadCSV } from '../core/utils'

type ModuleLookupFn = (moduleName: string) => string[]

interface GroupedDisplayRow {
  module: string
  type: string
  api: string
  version: string
  apps: string
}

export class TableManager {
  private groupedRows: Map<string, string[]> = new Map()
  private currentGroupedRows: GroupedDisplayRow[] = []

  constructor(
    private store: AppStore,
    private tbody: HTMLTableSectionElement,
    private getAppsForModule: ModuleLookupFn
  ) {}

  renderTable(rows: DependencyRow[]): void {
    this.groupedRows = this.buildGroupedRows(rows)
    this.tbody.innerHTML = ''
    this.currentGroupedRows = []
    const fragment = document.createDocumentFragment()

    for (const [key, versions] of this.groupedRows) {
      const [module, type, api] = key.split('|')
      const versionText = [...new Set(versions)].join(', ')
      const apps = this.getAppsForModule(module)
      const appsText = apps.length > 0 ? apps.join(', ') : '-'

      this.currentGroupedRows.push({ module, type, api, version: versionText, apps: appsText })

      const tr = document.createElement('tr')
      tr.dataset.module = module
      tr.dataset.type = type
      tr.dataset.api = api
      tr.innerHTML = `
        <td>${module}</td>
        <td class="type-${type}">${type}</td>
        <td>${api}</td>
        <td>${versionText}</td>
        <td title="${appsText}">${appsText}</td>
        <td>
          <button class="view-usage-btn" data-api="${api}" title="View API usage details">View Usage</button>
        </td>
      `
      fragment.appendChild(tr)
    }

    this.tbody.appendChild(fragment)
    this.attachViewUsageListeners()
  }

  buildGroupedRows(rows: DependencyRow[]): Map<string, string[]> {
    const map = new Map<string, string[]>()
    for (const row of rows) {
      const key = `${row.module}|${row.type}|${row.api}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row.version || '?')
    }
    return map
  }

  filterTable(term: string): void {
    const lower = term.toLowerCase()
    let count = 0
    this.tbody.querySelectorAll<HTMLElement>('tr').forEach(tr => {
      const matches =
        (tr.dataset.module ?? '').toLowerCase().includes(lower) ||
        (tr.dataset.api ?? '').toLowerCase().includes(lower)
      tr.style.display = matches ? '' : 'none'
      if (matches) count++
    })
    const matchEl = document.getElementById('table-match-count')
    if (matchEl) matchEl.textContent = term ? `${count} matching rows` : ''
  }

  sortBy(column: 'module' | 'type' | 'api', ascending = true): void {
    const sorted = [...this.currentGroupedRows]
    sorted.sort((a, b) => {
      const av = (a[column] ?? '').toLowerCase()
      const bv = (b[column] ?? '').toLowerCase()
      return ascending ? av.localeCompare(bv) : bv.localeCompare(av)
    })

    this.tbody.innerHTML = ''
    const fragment = document.createDocumentFragment()

    for (const row of sorted) {
      const tr = document.createElement('tr')
      tr.dataset.module = row.module
      tr.dataset.type = row.type
      tr.dataset.api = row.api
      tr.innerHTML = `
        <td>${row.module}</td>
        <td class="type-${row.type}">${row.type}</td>
        <td>${row.api}</td>
        <td>${row.version}</td>
        <td title="${row.apps}">${row.apps}</td>
        <td>
          <button class="view-usage-btn" data-api="${row.api}" title="View API usage details">View Usage</button>
        </td>
      `
      fragment.appendChild(tr)
    }

    this.tbody.appendChild(fragment)
    this.attachViewUsageListeners()
  }

  private attachViewUsageListeners(): void {
    this.tbody.querySelectorAll<HTMLElement>('.view-usage-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        const api = btn.getAttribute('data-api')
        if (api) this.redirectToApiUsage(api)
      })
    })
  }

  private redirectToApiUsage(api: string): void {
    const apiTab = document.querySelector<HTMLElement>('.tab-button[data-tab="api"]')
    if (apiTab) {
      apiTab.click()
      setTimeout(() => {
        const input = document.getElementById('api-select') as HTMLInputElement | null
        if (input) {
          input.value = api
          input.dispatchEvent(new Event('input'))
        }
      }, 50)
    }
  }

  exportToCSV(): void {
    if (this.currentGroupedRows.length === 0) {
      alert('No data to export')
      return
    }
    const header = ['Module', 'Type', 'API', 'Version(s)', 'Part of Apps']
    const dataRows = this.currentGroupedRows.map(r => [r.module, r.type, r.api, r.version, r.apps])
    downloadCSV('folio-dependencies.csv', [header, ...dataRows])
  }
}
