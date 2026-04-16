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
  private deselectMode = false

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
      style: [
        { selector: 'node', style: { label: 'data(id)', 'font-size': 9, 'background-color': '#3498db' } },
        { selector: 'node.selected-root', style: { 'background-color': '#e74c3c' } },
        { selector: 'edge', style: { 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', width: 1 } },
      ],
    })
    let clickTimer: ReturnType<typeof setTimeout> | null = null
    this.cy.on('tap', 'node', (e: EventObject) => {
      const node = e.target as NodeSingular
      if (clickTimer) {
        clearTimeout(clickTimer); clickTimer = null; this.focusOnNode(node)
      } else {
        clickTimer = setTimeout(() => { clickTimer = null; if (this.deselectMode) this.deselectModule(node.id()) }, 300)
      }
    })
  }

  expandModule(moduleName: string): void {
    if (!this.cy) return
    this.addNode(moduleName, true)
    for (const apiId of this.providesByModule.get(moduleName) ?? []) {
      for (const consumer of this.dependentsMap.get(apiId) ?? []) {
        this.addNode(consumer, false)
        const edgeId = `${moduleName}->${consumer}`
        if (!this.cy.getElementById(edgeId).length) {
          this.cy.add({ data: { id: edgeId, source: moduleName, target: consumer } })
        }
      }
    }
    this.cy.layout({ name: 'breadthfirst', directed: true, padding: 20 } as Parameters<Core['layout']>[0]).run()
  }

  private addNode(id: string, isRoot: boolean): void {
    if (!this.cy || this.addedNodes.has(id)) return
    this.addedNodes.add(id)
    const node = this.cy.add({ data: { id } })
    if (isRoot) node.addClass('selected-root')
  }

  deselectModule(moduleId: string): void {
    if (!this.cy) return
    this.cy.getElementById(moduleId).remove()
    this.addedNodes.delete(moduleId)
    this.selectedModules.delete(moduleId)
    this.cy.nodes().filter(n => n.connectedEdges().length === 0 && !this.selectedModules.has(n.id())).remove()
    this.cy.layout({ name: 'breadthfirst', directed: true, padding: 20 } as Parameters<Core['layout']>[0]).run()
  }

  clearGraph(): void {
    this.cy?.destroy(); this.cy = null
    this.addedNodes.clear(); this.selectedModules.clear()
  }

  toggleDeselectMode(): void { this.deselectMode = !this.deselectMode }
  isDeselectMode(): boolean { return this.deselectMode }

  exportGraph(): void {
    if (!this.cy) return
    const blob = this.cy.png({ output: 'blob', bg: 'white', full: true, scale: 2 }) as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'module-consumers.png'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  private focusOnNode(node: NodeSingular): void {
    this.cy?.animate({ fit: { eles: node.closedNeighborhood(), padding: 50 } })
  }
}
