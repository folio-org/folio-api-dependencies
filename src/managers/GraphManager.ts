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
    this.cy.layout(opts as unknown as Parameters<Core['layout']>[0]).run()
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
