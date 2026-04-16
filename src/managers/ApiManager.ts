import type { AppStore } from '../store/AppStore'
import type { DependencyRow } from '../types/index'
import { downloadCSV } from '../core/utils'

export class ApiManager {
  private currentApiId: string | null = null

  constructor(private store: AppStore, private container: HTMLElement) {}

  selectApi(apiId: string): void {
    this.currentApiId = apiId.trim()
    const entry = this.store.getApiIndex().get(this.currentApiId)
    if (!entry) {
      this.container.innerHTML = `<p>API "<strong>${this.currentApiId}</strong>" not found.</p>`
      return
    }
    this.container.innerHTML = `
      <h3>${this.currentApiId}</h3>
      ${this.renderSection('Providers', entry.provides)}
      ${this.renderSection('Consumers (required)', entry.requires)}
      ${this.renderSection('Optional users', entry.optional)}
      <button id="export-api-csv">Export CSV</button>
    `
    this.container.querySelector('#export-api-csv')?.addEventListener('click', () => {
      this.exportToCSV(this.currentApiId!, entry)
    })
  }

  private renderSection(title: string, rows: DependencyRow[]): string {
    if (rows.length === 0) return ''
    return `<h4>${title}</h4><ul>${rows.map(r => `<li>${r.module} <code>${r.version}</code></li>`).join('')}</ul>`
  }

  private exportToCSV(
    apiId: string,
    entry: { provides: DependencyRow[]; requires: DependencyRow[]; optional: DependencyRow[] }
  ): void {
    const header = ['API', 'Module', 'Relationship', 'Version']
    const dataRows: string[][] = [
      ...entry.provides.map(r => [apiId, r.module, 'provides', r.version]),
      ...entry.requires.map(r => [apiId, r.module, 'requires', r.version]),
      ...entry.optional.map(r => [apiId, r.module, 'optional', r.version]),
    ]
    downloadCSV(`${apiId}-usage.csv`, [header, ...dataRows])
  }
}
