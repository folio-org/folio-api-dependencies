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
