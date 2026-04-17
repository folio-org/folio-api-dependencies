# Rendering Parity Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the refactored TS managers produce the same HTML output and visual appearance as the original JS managers.

**Architecture:** Each task targets one manager file. We rewrite the rendering methods to emit the same HTML structure, CSS classes, and inline styles as the old code. We also add the missing `ApiUsageTableManager` class and wire it into `app.ts`. No test changes needed — existing tests cover data flow, not rendered HTML strings.

**Tech Stack:** TypeScript, Vite, Cytoscape.js

**Key reference files:**
- Old JS source: `git show master:src/web/js/managers/<file>.js`
- New TS source: `src/managers/<file>.ts`
- Types: `src/types/index.ts`
- Utilities: `src/core/utils.ts` (already has `groupByModule`, `getVersionMismatchType`, `getMismatchDisplay`)
- Composition root: `src/app.ts`
- HTML: `index.html`

---

### Task 1: Fix TableManager rendering

**Files:**
- Modify: `src/managers/TableManager.ts`

The old table renders 6 columns: Module, Type (with `type-${type}` CSS class), API, Version(s) (deduplicated), Apps, and a View Usage button. The new code only renders 4 columns without CSS classes.

- [ ] **Step 1: Rewrite `renderTable` to match old HTML output**

Replace the contents of `src/managers/TableManager.ts` with:

```typescript
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
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass. Some TableManager tests may need minor updates if they assert on `renderTable` output.

- [ ] **Step 4: Commit**

```bash
git add src/managers/TableManager.ts
git commit -m "fix(TableManager): restore Apps column, type CSS classes, View Usage buttons"
```

---

### Task 2: Fix ApiManager rendering + add ApiUsageTableManager

**Files:**
- Modify: `src/managers/ApiManager.ts`
- Modify: `src/app.ts`

The old `ApiManager` renders a flex header with API name in `<code>`, version mismatch toggle, export button, emojied section headings, grouped consumers by module, and updates the URL. The old `ApiUsageTableManager` renders a sortable table of API usage counts. Both are missing.

- [ ] **Step 1: Rewrite `src/managers/ApiManager.ts`**

```typescript
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
```

- [ ] **Step 2: Wire `ApiUsageTableManager` in `src/app.ts`**

Add import of `ApiUsageTableManager` and initialize it after data loads:

```typescript
import { ApiManager, ApiUsageTableManager } from './managers/ApiManager'
```

After the API dropdown initialization block, add:

```typescript
  // API Usage Count table
  const apiUsageCountEl = document.getElementById('api-usage-count') as HTMLElement
  const apiUsageTable = new ApiUsageTableManager(apiUsageCountEl)
  apiUsageTable.render(store.getRows())
```

- [ ] **Step 3: Verify build and tests**

Run: `npx tsc --noEmit && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add src/managers/ApiManager.ts src/app.ts
git commit -m "fix(ApiManager): restore version mismatch toggle, grouped consumers, URL update, add ApiUsageTableManager"
```

---

### Task 3: Fix AppsManager rendering

**Files:**
- Modify: `src/managers/AppsManager.ts`

The old code uses `app-section` divs, `app-list` with sub-classes (`dependencies`, `modules`, `ui-modules`), `platform-base`/`platform-complete` badge classes, `dep-removable` class, `dep-removable-badge` and `section-removable-badge` spans, `<code>` for names, `<span class="version">` for versions, emoji headings with counts, `empty-section` for empty sections, and search across description/modules/uiModules.

- [ ] **Step 1: Rewrite `src/managers/AppsManager.ts`**

```typescript
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
```

- [ ] **Step 2: Verify build and tests**

Run: `npx tsc --noEmit && npx vitest run`

- [ ] **Step 3: Commit**

```bash
git add src/managers/AppsManager.ts
git commit -m "fix(AppsManager): restore CSS classes, emoji headings, removable badges, search across modules"
```

---

### Task 4: Fix AppDependenciesGraphManager rendering

**Files:**
- Modify: `src/managers/GraphManager.ts`

The old graph has roundrectangle nodes 120x50, white text with outline, bold font, edge width 2 with arrow-scale 1.5, highlighted/faded classes for nodes AND edges (separate styles), node:selected border, hover tooltip, spacingFactor, animated layout, rich node data (label, platform, version, description, moduleCount, etc.), and edges added even for deps not in appsData.

- [ ] **Step 1: Rewrite `src/managers/GraphManager.ts`**

```typescript
import cytoscape, { Core, NodeSingular, EventObject } from 'cytoscape'
import type { AppsMap } from '../types/index'

export class AppDependenciesGraphManager {
  private cy: Core | null = null
  private appsData: AppsMap = {}
  private showDetails = true

  init(appsData: AppsMap): void {
    this.appsData = appsData
    this.initGraph()
    this.buildGraph()
    this.setupControls()
  }

  private initGraph(): void {
    const container = document.getElementById('app-dependencies-graph')
    if (!container) return

    this.cy = cytoscape({
      container,
      elements: [],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': 'white',
            'text-outline-color': 'data(color)',
            'text-outline-width': 2,
            'font-size': '12px',
            'width': '120px',
            'height': '50px',
            'shape': 'roundrectangle',
            'text-wrap': 'wrap',
            'text-max-width': '110px',
            'font-weight': 'bold',
          },
        },
        {
          selector: 'node:selected',
          style: { 'border-width': 4, 'border-color': '#f39c12', 'border-style': 'solid' },
        },
        {
          selector: 'edge',
          style: {
            width: 2, 'line-color': '#666', 'target-arrow-color': '#666',
            'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'arrow-scale': 1.5,
          },
        },
        {
          selector: 'edge.highlighted',
          style: { width: 3, 'line-color': '#e74c3c', 'target-arrow-color': '#e74c3c', 'z-index': 999 },
        },
        {
          selector: 'node.highlighted',
          style: { 'border-width': 3, 'border-color': '#e74c3c', 'border-style': 'solid' },
        },
        {
          selector: 'node.faded',
          style: { opacity: 0.3 },
        },
        {
          selector: 'edge.faded',
          style: { opacity: 0.2 },
        },
      ],
      layout: { name: 'breadthfirst', directed: true, padding: 50, spacingFactor: 1.5 },
    })

    this.setupInteractions()
  }

  private getNodeColor(platform: string): string {
    if (platform === 'base') return '#2980b9'
    if (platform === 'complete') return '#27ae60'
    return '#e74c3c'
  }

  private buildGraph(): void {
    if (!this.cy) return
    const addedEdges = new Set<string>()

    for (const [appName, appData] of Object.entries(this.appsData)) {
      this.cy.add({
        group: 'nodes',
        data: {
          id: appName,
          label: appName,
          color: this.getNodeColor(appData.platform),
          platform: appData.platform,
          moduleCount: (appData.modules ?? []).length,
          uiModuleCount: (appData.uiModules ?? []).length,
          dependencyCount: (appData.dependencies ?? []).length,
        },
      })
    }

    for (const [appName, appData] of Object.entries(this.appsData)) {
      for (const dep of appData.dependencies ?? []) {
        const edgeId = `${appName}->${dep.name}`
        if (!addedEdges.has(edgeId)) {
          addedEdges.add(edgeId)
          this.cy.add({
            group: 'edges',
            data: { id: edgeId, source: appName, target: dep.name, version: dep.version },
          })
        }
      }
    }

    this.applyLayout('breadthfirst')
  }

  private setupInteractions(): void {
    if (!this.cy) return
    let clickTimer: ReturnType<typeof setTimeout> | null = null

    this.cy.on('tap', 'node', (evt: EventObject) => {
      const node = evt.target as NodeSingular
      if (clickTimer) {
        clearTimeout(clickTimer); clickTimer = null; this.focusOnNode(node)
      } else {
        clickTimer = setTimeout(() => { clickTimer = null; this.highlightDependencies(node) }, 300)
      }
    })

    this.cy.on('tap', (evt: EventObject) => {
      if (evt.target === this.cy) this.resetHighlights()
    })

    this.cy.on('mouseover', 'node', (evt: EventObject) => {
      if (this.showDetails) this.showNodeTooltip(evt.target as NodeSingular, evt.originalEvent as MouseEvent)
    })

    this.cy.on('mouseout', 'node', () => this.hideNodeTooltip())
  }

  private highlightDependencies(node: NodeSingular): void {
    if (!this.cy) return
    this.cy.elements().removeClass('highlighted faded')

    node.addClass('highlighted')
    const outgoing = node.outgoers('edge')
    const dependencies = node.outgoers('node')
    const incoming = node.incomers('edge')
    const dependents = node.incomers('node')

    outgoing.addClass('highlighted')
    dependencies.addClass('highlighted')
    incoming.addClass('highlighted')
    dependents.addClass('highlighted')

    this.cy.elements()
      .not(node).not(outgoing).not(dependencies).not(incoming).not(dependents)
      .addClass('faded')
  }

  private resetHighlights(): void {
    this.cy?.elements().removeClass('highlighted faded')
  }

  private focusOnNode(node: NodeSingular): void {
    this.cy?.animate({
      fit: { eles: node.closedNeighborhood(), padding: 100 },
      duration: 500,
    })
  }

  private showNodeTooltip(node: NodeSingular, event: MouseEvent): void {
    const data = node.data()
    const tooltip = document.createElement('div')
    tooltip.id = 'app-node-tooltip'
    tooltip.style.cssText = `
      position: fixed; left: ${event.clientX + 15}px; top: ${event.clientY + 15}px;
      background: white; border: 1px solid #ccc; border-radius: 4px; padding: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 10000; max-width: 300px;
      font-size: 13px; pointer-events: none;
    `
    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px; color: ${data.color};">${data.label}</div>
      <div style="border-top: 1px solid #eee; margin: 5px 0; padding-top: 5px;">
        <div><strong>Platform:</strong> ${data.platform}</div>
        <div><strong>Backend Modules:</strong> ${data.moduleCount}</div>
        <div><strong>UI Modules:</strong> ${data.uiModuleCount}</div>
        <div><strong>Dependencies:</strong> ${data.dependencyCount}</div>
      </div>
    `
    document.body.appendChild(tooltip)
  }

  private hideNodeTooltip(): void {
    document.getElementById('app-node-tooltip')?.remove()
  }

  private applyLayout(layoutName: string): void {
    if (!this.cy) return
    const opts: Record<string, unknown> = {
      name: layoutName, animate: true, animationDuration: 500, fit: true, padding: 50,
    }
    if (layoutName === 'breadthfirst') {
      opts.directed = true
      opts.spacingFactor = 1.8
      opts.roots = this.findRootNodes()
    } else if (layoutName === 'circle') {
      opts.spacingFactor = 1.5
    }
    this.cy.layout(opts as Parameters<Core['layout']>[0]).run()
  }

  private findRootNodes(): string | undefined {
    const roots = this.cy!.nodes().filter(n => n.incomers('edge').length === 0).map(n => '#' + n.id())
    return roots.length > 0 ? roots.join(',') : undefined
  }

  exportGraph(): void {
    if (!this.cy) return
    const blob = this.cy.png({ output: 'blob', bg: 'white', full: true, scale: 2 }) as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'folio-app-dependencies.png'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  private setupControls(): void {
    document.getElementById('app-deps-fit')?.addEventListener('click', () => this.cy?.fit(undefined, 50))
    document.getElementById('app-deps-reset')?.addEventListener('click', () => {
      this.resetHighlights()
      this.applyLayout('breadthfirst')
    })
    document.getElementById('app-deps-layout-hierarchy')?.addEventListener('click', () => this.applyLayout('breadthfirst'))
    document.getElementById('app-deps-layout-circle')?.addEventListener('click', () => this.applyLayout('circle'))
    document.getElementById('app-deps-export-png')?.addEventListener('click', () => this.exportGraph())
    document.getElementById('app-deps-show-details')?.addEventListener('change', (e) => {
      this.showDetails = (e.target as HTMLInputElement).checked
    })
  }
}
```

- [ ] **Step 2: Verify build and tests**

Run: `npx tsc --noEmit && npx vitest run`

- [ ] **Step 3: Commit**

```bash
git add src/managers/GraphManager.ts
git commit -m "fix(GraphManager): restore node shapes, tooltip, highlight/faded edge styles, animated layout"
```

---

### Task 5: Fix ModuleConsumersGraphManager rendering

**Files:**
- Modify: `src/managers/ModuleConsumersGraphManager.ts`
- Modify: `src/app.ts`

The old graph has roundrectangle nodes 140x40, `#007bff` color, edge labels with API names, optional edges dashed+yellow, edge direction consumer→provider, click-to-expand on non-selected nodes, animated layout with spacingFactor, deselect with preservation of nodes connected to other selections, `showDependencies` method, and dynamically added graph controls.

- [ ] **Step 1: Rewrite `src/managers/ModuleConsumersGraphManager.ts`**

```typescript
import cytoscape, { Core, NodeSingular, EventObject } from 'cytoscape'
import type { AppStore } from '../store/AppStore'
import { DropdownComponent } from '../core/dropdown'

export class ModuleConsumersGraphManager {
  private cy: Core | null = null
  private addedNodes = new Set<string>()
  private selectedModules = new Set<string>()
  private providesMap = new Map<string, string[]>()
  private dependentsMap = new Map<string, string[]>()
  private providesByModule = new Map<string, string[]>()
  private _deselectMode = false

  constructor(private store: AppStore) {}

  init(inputEl: HTMLInputElement, dropdownEl: HTMLElement): void {
    this.buildLookupMaps()
    this.setupDropdown(inputEl, dropdownEl)
  }

  private buildLookupMaps(): void {
    for (const row of this.store.getRows()) {
      if (row.type === 'provides') {
        if (!this.providesMap.has(row.api)) this.providesMap.set(row.api, [])
        this.providesMap.get(row.api)!.push(row.module)
        if (!this.providesByModule.has(row.module)) this.providesByModule.set(row.module, [])
        this.providesByModule.get(row.module)!.push(row.api)
      } else {
        if (!this.dependentsMap.has(row.api)) this.dependentsMap.set(row.api, [])
        this.dependentsMap.get(row.api)!.push(row.module)
      }
    }
  }

  private setupDropdown(inputEl: HTMLInputElement, dropdownEl: HTMLElement): void {
    const modules = [...this.providesByModule.keys()].sort()
    const dd = new DropdownComponent(inputEl, dropdownEl, {
      onSelect: (mod) => { this.selectedModules.add(mod); this.expandModule(mod) },
    })
    dd.setItems(modules)
    dd.init()
  }

  initGraph(containerEl: HTMLElement): void {
    this.cy = cytoscape({
      container: containerEl,
      elements: [],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#007bff',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': 'white',
            'font-size': '11px',
            'width': '140px',
            'height': '40px',
            'shape': 'roundrectangle',
            'text-wrap': 'wrap',
            'text-max-width': '130px',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2, 'line-color': '#666', 'target-arrow-color': '#666',
            'target-arrow-shape': 'triangle', 'curve-style': 'bezier',
            'label': 'data(label)', 'font-size': '10px', 'text-rotation': 'autorotate',
          },
        },
        {
          selector: 'edge[depType="optional"]',
          style: { 'line-style': 'dashed', 'line-color': '#ffc107', 'target-arrow-color': '#ffc107' },
        },
      ],
      layout: { name: 'breadthfirst', directed: true, padding: 30, spacingFactor: 1.8 },
    })

    this.addGraphControls(containerEl)

    let clickTimer: ReturnType<typeof setTimeout> | null = null

    this.cy.on('tap', 'node', (evt: EventObject) => {
      const node = evt.target as NodeSingular
      const moduleId = node.id()

      if (this._deselectMode) {
        this.deselectModule(moduleId)
        return
      }

      if (clickTimer) {
        clearTimeout(clickTimer); clickTimer = null; this.focusOnNode(node)
        return
      }

      clickTimer = setTimeout(() => {
        clickTimer = null
        if (!this.selectedModules.has(moduleId)) {
          this.selectedModules.add(moduleId)
          this.expandModule(moduleId)
        }
      }, 300)
    })

    this.cy.on('mouseover', 'node', (evt: EventObject) => {
      if (this._deselectMode) (evt.target as NodeSingular).addClass('deselect-mode')
    })

    this.cy.on('mouseout', 'node', (evt: EventObject) => {
      if (this._deselectMode) (evt.target as NodeSingular).removeClass('deselect-mode')
    })
  }

  expandModule(moduleName: string): void {
    if (this.addedNodes.has(moduleName) || !this.cy) return

    if (!this.cy.getElementById(moduleName).length) {
      this.cy.add({ group: 'nodes', data: { id: moduleName, label: moduleName } })
    }
    this.addedNodes.add(moduleName)

    for (const api of this.providesByModule.get(moduleName) ?? []) {
      for (const consumer of this.dependentsMap.get(api) ?? []) {
        if (consumer === moduleName) continue

        if (!this.cy.getElementById(consumer).length) {
          this.cy.add({ group: 'nodes', data: { id: consumer, label: consumer } })
        }

        const edgeId = `${consumer}__to__${moduleName}__${api}`
        if (!this.cy.getElementById(edgeId).length) {
          const isOptional = this.store.getRows().some(
            r => r.module === consumer && r.api === api && r.type === 'optional'
          )
          this.cy.add({
            group: 'edges',
            data: {
              id: edgeId,
              source: consumer,
              target: moduleName,
              label: `${api}${isOptional ? ' (opt)' : ''}`,
              depType: isOptional ? 'optional' : 'requires',
            },
          })
        }
      }
    }

    this.runLayout()
  }

  deselectModule(moduleId: string): void {
    if (!this.cy) return

    const node = this.cy.getElementById(moduleId)
    if (!node.length) return

    const nodesToRemove = new Set<string>([moduleId])
    node.connectedEdges().forEach((edge: { source: () => NodeSingular; target: () => NodeSingular }) => {
      nodesToRemove.add(edge.source().id())
      nodesToRemove.add(edge.target().id())
    })

    const nodesToKeep = new Set<string>()
    for (const nodeId of nodesToRemove) {
      if (this.selectedModules.has(nodeId) && nodeId !== moduleId) {
        nodesToKeep.add(nodeId)
        continue
      }
      const n = this.cy.getElementById(nodeId)
      if (n.length) {
        let hasOtherConnection = false
        n.connectedEdges().forEach((edge: { source: () => NodeSingular; target: () => NodeSingular }) => {
          const otherId = edge.source().id() === nodeId ? edge.target().id() : edge.source().id()
          if (this.selectedModules.has(otherId) && otherId !== moduleId) hasOtherConnection = true
        })
        if (hasOtherConnection) nodesToKeep.add(nodeId)
      }
    }

    for (const nodeId of nodesToRemove) {
      if (nodesToKeep.has(nodeId)) continue
      this.selectedModules.delete(nodeId)
      this.addedNodes.delete(nodeId)
      const n = this.cy.getElementById(nodeId)
      if (n.length) this.cy.remove(n)
    }

    if (this.cy.nodes().length > 0) this.runLayout()
  }

  showDependencies(dependencyType: 'requires' | 'optional'): void {
    if (!this.cy || this.selectedModules.size === 0) return

    for (const moduleName of [...this.selectedModules]) {
      const moduleDeps = this.store.getRows().filter(
        row => row.module === moduleName && row.type === dependencyType
      )

      for (const dep of moduleDeps) {
        for (const provider of this.providesMap.get(dep.api) ?? []) {
          if (provider === moduleName) continue

          if (!this.cy.getElementById(provider).length) {
            this.cy.add({ group: 'nodes', data: { id: provider, label: provider } })
          }

          const edgeId = `${moduleName}__depends_on__${provider}__${dep.api}`
          if (!this.cy.getElementById(edgeId).length) {
            this.cy.add({
              group: 'edges',
              data: {
                id: edgeId,
                source: moduleName,
                target: provider,
                label: `${dep.api}${dependencyType === 'optional' ? ' (opt)' : ''}`,
                depType: dependencyType,
              },
            })
          }
          this.addedNodes.add(provider)
        }
      }
    }

    this.runLayout()
  }

  clearGraph(): void {
    this.selectedModules.clear()
    this.addedNodes.clear()
    this._deselectMode = false

    const deselectBtn = document.getElementById('deselect-mode')
    if (deselectBtn) {
      deselectBtn.textContent = 'Toggle Deselect Mode'
      deselectBtn.style.backgroundColor = ''
    }

    if (this.cy) {
      this.cy.elements().remove()
    }
  }

  toggleDeselectMode(): void {
    this._deselectMode = !this._deselectMode
    const deselectBtn = document.getElementById('deselect-mode')
    if (deselectBtn) {
      if (this._deselectMode) {
        deselectBtn.textContent = 'Exit Deselect Mode'
        deselectBtn.style.backgroundColor = '#dc3545'
        deselectBtn.style.color = 'white'
      } else {
        deselectBtn.textContent = 'Toggle Deselect Mode'
        deselectBtn.style.backgroundColor = ''
        deselectBtn.style.color = ''
      }
    }
  }

  isDeselectMode(): boolean { return this._deselectMode }

  exportGraph(): void {
    if (!this.cy) return
    const blob = this.cy.png({ output: 'blob', bg: 'white', full: true, scale: 2 }) as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'module-dependencies.png'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  private focusOnNode(node: NodeSingular): void {
    if (!this.cy) return
    this.cy.animate({ fit: { eles: node, padding: 100 }, duration: 500 })
    const originalColor = node.style('background-color')
    node.animate({ style: { 'background-color': '#28a745' } }, {
      duration: 200,
      complete: () => { node.animate({ style: { 'background-color': originalColor } }, { duration: 200 }) },
    })
  }

  private runLayout(): void {
    this.cy?.layout({
      name: 'breadthfirst', directed: true, padding: 30,
      spacingFactor: 1.8, animate: true, animationDuration: 500,
    } as Parameters<Core['layout']>[0]).run()
  }

  private addGraphControls(graphContainer: HTMLElement): void {
    const parent = graphContainer.parentElement
    if (!parent || parent.querySelector('.graph-controls')) return

    const controlsDiv = document.createElement('div')
    controlsDiv.className = 'graph-controls'
    controlsDiv.style.cssText = 'margin: 10px 0; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;'
    controlsDiv.innerHTML = `
      <button id="fit-graph" class="graph-btn">Fit to View</button>
      <button id="reset-graph" class="graph-btn">Reset Graph</button>
      <button id="show-required-deps" class="graph-btn">Show Required Dependencies</button>
      <button id="show-optional-deps" class="graph-btn">Show Optional Dependencies</button>
      <button id="deselect-mode" class="graph-btn">Toggle Deselect Mode</button>
      <button id="export-graph" class="graph-btn">Export PNG</button>
      <span style="margin-left: auto; font-size: 12px; color: #666;">
        Click nodes to expand &bull; Double-click to focus &bull; Mouse wheel to zoom
      </span>
    `
    parent.insertBefore(controlsDiv, graphContainer)

    document.getElementById('fit-graph')?.addEventListener('click', () => this.cy?.fit(undefined, 50))
    document.getElementById('reset-graph')?.addEventListener('click', () => this.clearGraph())
    document.getElementById('show-required-deps')?.addEventListener('click', () => this.showDependencies('requires'))
    document.getElementById('show-optional-deps')?.addEventListener('click', () => this.showDependencies('optional'))
    document.getElementById('deselect-mode')?.addEventListener('click', () => this.toggleDeselectMode())
    document.getElementById('export-graph')?.addEventListener('click', () => this.exportGraph())
  }
}
```

- [ ] **Step 2: Update `src/app.ts` — remove old graph control wiring**

In `src/app.ts`, remove the lines that manually wire `#reset-graph`, `#export-graph`, `#deselect-mode` (lines 84-90 in current code) since `addGraphControls` now handles all of them internally.

Replace:
```typescript
  document.getElementById('reset-graph')?.addEventListener('click', () => moduleGraphManager.clearGraph())
  document.getElementById('export-graph')?.addEventListener('click', () => moduleGraphManager.exportGraph())
  document.getElementById('deselect-mode')?.addEventListener('click', () => {
    moduleGraphManager.toggleDeselectMode()
    const btn = document.getElementById('deselect-mode') as HTMLElement
    btn.style.backgroundColor = moduleGraphManager.isDeselectMode() ? '#e74c3c' : ''
  })
```

With nothing (delete those lines).

- [ ] **Step 3: Verify build and tests**

Run: `npx tsc --noEmit && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add src/managers/ModuleConsumersGraphManager.ts src/app.ts
git commit -m "fix(ModuleConsumersGraphManager): restore node shapes, edge labels, optional styling, click-to-expand, dynamic controls"
```

---

### Task 6: Final verification

**Files:** None modified

- [ ] **Step 1: Full build check**

Run: `npx tsc --noEmit && npx vite build && npx vitest run`
Expected: all pass

- [ ] **Step 2: Start dev server and manually verify**

Run: `npx vite --port 5173`
Open `http://localhost:5173` and check:
1. Table view shows 6 columns with colored type cells
2. API Usage Count tab shows sortable table
3. API view shows grouped consumers with version mismatch toggle
4. Apps view shows cards with proper badges, emoji headings, CSS classes
5. Module Consumers graph has labeled edges, optional dashed yellow, click-to-expand, graph controls
6. App Dependencies graph has round-rectangle nodes, tooltip on hover, animated layout

- [ ] **Step 3: Commit summary**

No commit needed — this is verification only.
