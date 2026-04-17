import type { AppsMap, RemovableDepsMap } from '../types/index'

export class AppsManager {
  private removableDeps: RemovableDepsMap = new Map()
  private allApps: { repoName: string; data: AppsMap[string] }[] = []

  constructor(private container: HTMLElement) {}

  init(appsData: AppsMap, removableDeps: RemovableDepsMap): void {
    this.removableDeps = removableDeps
    this.allApps = Object.entries(appsData).map(([repoName, data]) => ({ repoName, data }))
    this.renderApps(this.allApps)
  }

  filter(term: string): void {
    const lower = term.toLowerCase()
    if (!lower) {
      this.renderApps(this.allApps)
      return
    }
    const filtered = this.allApps.filter(app =>
      app.repoName.toLowerCase().includes(lower) ||
      (app.data.modules ?? []).some(m => m.name.toLowerCase().includes(lower)) ||
      (app.data.uiModules ?? []).some(u => u.name.toLowerCase().includes(lower))
    )
    this.renderApps(filtered)
  }

  private renderApps(apps: { repoName: string; data: AppsMap[string] }[]): void {
    if (apps.length === 0) {
      this.container.innerHTML = '<p>No apps found.</p>'
      return
    }
    this.container.innerHTML = apps.map(a => this.renderCard(a.repoName, a.data)).join('')
  }

  private renderCard(repoName: string, data: AppsMap[string]): string {
    const platformClass = data.platform === 'base' ? 'platform-base' : 'platform-complete'

    return `
      <div class="app-card">
        <h3>
          <a href="https://github.com/folio-org/${repoName}" target="_blank" style="text-decoration: none; color: inherit;">${repoName}</a>
          <span class="app-platform ${platformClass}">${data.platform}</span>
        </h3>
        ${this.renderDependencies(repoName, data)}
        ${this.renderModules(data)}
        ${this.renderUiModules(data)}
      </div>
    `
  }

  private renderDependencies(repoName: string, data: AppsMap[string]): string {
    if (!data.dependencies || data.dependencies.length === 0) {
      return '<div class="app-section"><h4>📦 Dependencies</h4><div class="empty-section">No dependencies</div></div>'
    }

    const unusedForApp = this.removableDeps.get(repoName) ?? new Set()

    const items = data.dependencies.map(dep => {
      const isRemovable = unusedForApp.has(dep.name)
      const badge = isRemovable
        ? `<span class="dep-removable-badge" title="No interface overlap detected between this app's modules and the dependency's provided APIs. This dependency may be removable.">⚠️ may be removable</span>`
        : ''
      const liClass = isRemovable ? ' class="dep-removable"' : ''
      return `<li${liClass}><code>${dep.name}</code> <span class="version">${dep.version}</span> ${badge}</li>`
    }).join('')

    const removableCount = unusedForApp.size
    const warningBadge = removableCount > 0
      ? `<span class="section-removable-badge" title="${removableCount} dependenc${removableCount === 1 ? 'y' : 'ies'} with no detected interface usage">${removableCount} possibly unused</span>`
      : ''

    return `
      <div class="app-section">
        <h4>📦 Dependencies (${data.dependencies.length}) ${warningBadge}</h4>
        <ul class="app-list dependencies">${items}</ul>
      </div>
    `
  }

  private renderModules(data: AppsMap[string]): string {
    if (!data.modules || data.modules.length === 0) {
      return '<div class="app-section"><h4>⚙️ Backend Modules</h4><div class="empty-section">No modules</div></div>'
    }
    const items = data.modules.map(mod =>
      `<li><code>${mod.name}</code> <span class="version">${mod.version}</span></li>`
    ).join('')
    return `
      <div class="app-section">
        <h4>⚙️ Backend Modules (${data.modules.length})</h4>
        <ul class="app-list modules">${items}</ul>
      </div>
    `
  }

  private renderUiModules(data: AppsMap[string]): string {
    if (!data.uiModules || data.uiModules.length === 0) {
      return '<div class="app-section"><h4>🎨 UI Modules</h4><div class="empty-section">No UI modules</div></div>'
    }
    const items = data.uiModules.map(ui =>
      `<li><code>${ui.name}</code> <span class="version">${ui.version}</span></li>`
    ).join('')
    return `
      <div class="app-section">
        <h4>🎨 UI Modules (${data.uiModules.length})</h4>
        <ul class="app-list ui-modules">${items}</ul>
      </div>
    `
  }
}
