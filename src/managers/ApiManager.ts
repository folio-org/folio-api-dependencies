import type { AppStore } from '../store/AppStore'
import type { DependencyRow } from '../types/index'
import { downloadCSV, groupByModule, getVersionMismatchType, getMismatchDisplay } from '../core/utils'

export class ApiManager {
  private currentApiId: string | null = null
  private showVersionMismatch = false

  constructor(private store: AppStore, private container: HTMLElement) {}

  selectApi(apiId: string): void {
    this.currentApiId = apiId.trim()
    const entry = this.store.getApiIndex().get(this.currentApiId)
    if (!entry) {
      this.container.innerHTML = `<p>No data for API <code>${this.currentApiId}</code></p>`
      this.currentApiId = null
      return
    }
    this.renderApiUsage(this.currentApiId, entry)
    this.updateUrl(this.currentApiId)
  }

  private renderApiUsage(
    apiId: string,
    data: { provides: DependencyRow[]; requires: DependencyRow[]; optional: DependencyRow[] }
  ): void {
    const providedVersions = data.provides.map(p => p.version)

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1em;">
        <h3 style="margin: 0;">API: <code>${apiId}</code></h3>
        <div style="display: flex; align-items: center; gap: 12px;">
          <button id="toggle-version-warnings" style="
            padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s ease;
            background-color: ${this.showVersionMismatch ? '#ffc107' : '#6c757d'};
            color: ${this.showVersionMismatch ? '#000' : '#fff'};
          " title="${this.showVersionMismatch ? 'Hide version mismatch warnings' : 'Show version mismatch warnings'}">
            ${this.showVersionMismatch ? '⚠️ Hide Warnings' : '👁️ Show Warnings'}
          </button>
          <button id="export-api-csv" class="export-csv-btn" title="Export API usage data to CSV">📊 Export CSV</button>
        </div>
      </div>
    `

    // Provides
    html += `<h4>✅ Provided by:</h4><ul>`
    if (data.provides.length === 0) {
      html += `<li><em>No providers</em></li>`
    } else {
      for (const p of data.provides) {
        html += `<li><code>${p.module}</code> (${p.version || 'n/a'})</li>`
      }
    }
    html += `</ul>`

    // Requires
    html += `<h4>🔍 Required by:</h4><ul>`
    if (data.requires.length === 0) {
      html += `<li><em>No consumers</em></li>`
    } else {
      const grouped = groupByModule(data.requires)
      for (const [mod, versions] of Object.entries(grouped)) {
        html += `<li><code>${mod}</code> (${versions.join(', ')})`
        if (this.showVersionMismatch) {
          const mismatch = getMismatchDisplay(getVersionMismatchType(versions, providedVersions))
          if (mismatch) html += ` ${mismatch.icon} <span style="color: ${mismatch.color};">${mismatch.text}</span>`
        }
        html += `</li>`
      }
    }
    html += `</ul>`

    // Optional
    html += `<h4>🟡 Optionally used by:</h4><ul>`
    if (data.optional.length === 0) {
      html += `<li><em>No optional users</em></li>`
    } else {
      const grouped = groupByModule(data.optional)
      for (const [mod, versions] of Object.entries(grouped)) {
        html += `<li><code>${mod}</code> (${versions.join(', ')})`
        if (this.showVersionMismatch) {
          const mismatch = getMismatchDisplay(getVersionMismatchType(versions, providedVersions))
          if (mismatch) html += ` ${mismatch.icon} <span style="color: ${mismatch.color};">${mismatch.text}</span>`
        }
        html += `</li>`
      }
    }
    html += `</ul>`

    this.container.innerHTML = html
    this.attachListeners(apiId, data)
  }

  private attachListeners(
    apiId: string,
    data: { provides: DependencyRow[]; requires: DependencyRow[]; optional: DependencyRow[] }
  ): void {
    document.getElementById('toggle-version-warnings')?.addEventListener('click', (e) => {
      e.preventDefault()
      this.showVersionMismatch = !this.showVersionMismatch
      this.renderApiUsage(apiId, data)
    })
    document.getElementById('export-api-csv')?.addEventListener('click', () => {
      this.exportApiUsageToCSV(apiId, data)
    })
  }

  private exportApiUsageToCSV(
    apiId: string,
    data: { provides: DependencyRow[]; requires: DependencyRow[]; optional: DependencyRow[] }
  ): void {
    const header = ['Module Name', 'API Versions', 'Dependency Type']
    const moduleData = new Map<string, Set<string>>()

    for (const r of data.requires) {
      const key = `${r.module}|required`
      if (!moduleData.has(key)) moduleData.set(key, new Set())
      moduleData.get(key)!.add(r.version || 'n/a')
    }
    for (const r of data.optional) {
      const key = `${r.module}|optional`
      if (!moduleData.has(key)) moduleData.set(key, new Set())
      moduleData.get(key)!.add(r.version || 'n/a')
    }

    const dataRows: string[][] = []
    for (const [key, versions] of moduleData) {
      const [moduleName, depType] = key.split('|')
      dataRows.push([moduleName, [...versions].sort().join(', '), depType])
    }
    dataRows.sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]))

    downloadCSV(`${apiId}_usage.csv`, [header, ...dataRows])
  }

  private updateUrl(api: string): void {
    const url = new URL(window.location.href)
    url.searchParams.set('api', api)
    history.replaceState({}, '', url.toString())
  }
}

export class ApiUsageTableManager {
  private currentData: { api: string; count: number; provider: string | null }[] = []
  private sortColumn: 'api' | 'count' = 'count'
  private sortAscending = false

  constructor(private containerEl: HTMLElement) {}

  render(rows: DependencyRow[]): void {
    const providesMap = new Map<string, string>()
    const usageMap = new Map<string, Set<string>>()

    for (const row of rows) {
      if (row.type === 'provides') {
        if (!providesMap.has(row.api)) providesMap.set(row.api, row.module)
      } else {
        if (!usageMap.has(row.api)) usageMap.set(row.api, new Set())
        usageMap.get(row.api)!.add(row.module)
      }
    }

    this.currentData = [...usageMap.entries()].map(([api, users]) => ({
      api,
      count: users.size,
      provider: providesMap.get(api) ?? null,
    }))

    this.sortData()
    this.renderTable()
  }

  private sortData(): void {
    this.currentData.sort((a, b) => {
      if (this.sortColumn === 'count') {
        return this.sortAscending ? a.count - b.count : b.count - a.count
      }
      const av = a.api.toLowerCase()
      const bv = b.api.toLowerCase()
      return this.sortAscending ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }

  private renderTable(): void {
    const apiClass = this.sortColumn === 'api' ? (this.sortAscending ? 'asc' : 'desc') : ''
    const countClass = this.sortColumn === 'count' ? (this.sortAscending ? 'asc' : 'desc') : ''

    this.containerEl.innerHTML = `
      <table class="simple-table">
        <thead>
          <tr>
            <th data-sort-usage="api" class="${apiClass}">API Interface</th>
            <th data-sort-usage="count" class="${countClass}">Usage Count</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${this.currentData.map(u => `
            <tr>
              <td>${u.provider
                ? `<a href="https://github.com/folio-org/${u.provider}" target="_blank">${u.api}</a>`
                : u.api}</td>
              <td>${u.count}</td>
              <td><button class="view-usage-btn" data-api="${u.api}">View Usage</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `

    this.attachListeners()
  }

  private attachListeners(): void {
    this.containerEl.querySelectorAll<HTMLElement>('th[data-sort-usage]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort-usage') as 'api' | 'count'
        if (this.sortColumn === col) {
          this.sortAscending = !this.sortAscending
        } else {
          this.sortColumn = col
          this.sortAscending = true
        }
        this.sortData()
        this.renderTable()
      })
    })

    this.containerEl.querySelectorAll<HTMLElement>('.view-usage-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const api = btn.getAttribute('data-api')
        if (!api) return
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
      })
    })
  }
}
