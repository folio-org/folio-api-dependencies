import cytoscape, { Core, NodeSingular, EventObject } from 'cytoscape'
import type { AppsMap } from '../types/index'

export class AppDependenciesGraphManager {
  private cy: Core | null = null
  private appsData: AppsMap = {}

  init(appsData: AppsMap): void {
    this.appsData = appsData
    this.initGraph()
    this.buildGraph()
    this.setupControls()
  }

  private initGraph(): void {
    this.cy = cytoscape({
      container: document.getElementById('app-dependencies-graph'),
      style: [
        { selector: 'node', style: { label: 'data(id)', 'background-color': 'data(color)', 'font-size': 10 } },
        { selector: 'edge', style: { 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', width: 1 } },
        { selector: '.highlighted', style: { 'border-width': 3, 'border-color': '#f39c12' } },
        { selector: '.faded', style: { opacity: 0.2 } },
      ],
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
    for (const [appName, appData] of Object.entries(this.appsData)) {
      this.cy.add({ data: { id: appName, color: this.getNodeColor(appData.platform) } })
    }
    for (const [appName, appData] of Object.entries(this.appsData)) {
      for (const dep of appData.dependencies) {
        if (this.appsData[dep.name]) {
          this.cy.add({ data: { id: `${appName}->${dep.name}`, source: appName, target: dep.name } })
        }
      }
    }
    this.applyLayout('breadthfirst')
  }

  private setupInteractions(): void {
    if (!this.cy) return
    let clickTimer: ReturnType<typeof setTimeout> | null = null
    this.cy.on('tap', 'node', (e: EventObject) => {
      const node = e.target as NodeSingular
      if (clickTimer) {
        clearTimeout(clickTimer); clickTimer = null
        this.focusOnNode(node)
      } else {
        clickTimer = setTimeout(() => { clickTimer = null; this.highlightDependencies(node) }, 300)
      }
    })
    this.cy.on('tap', (e: EventObject) => {
      if (e.target === this.cy) this.resetHighlights()
    })
  }

  private highlightDependencies(node: NodeSingular): void {
    this.cy?.elements().addClass('faded').removeClass('highlighted')
    node.removeClass('faded').addClass('highlighted')
    node.connectedEdges().removeClass('faded')
    node.neighborhood().nodes().removeClass('faded')
  }

  private resetHighlights(): void { this.cy?.elements().removeClass('highlighted faded') }

  private focusOnNode(node: NodeSingular): void {
    this.cy?.animate({ fit: { eles: node.closedNeighborhood(), padding: 50 } })
  }

  private applyLayout(name: 'breadthfirst' | 'circle'): void {
    if (!this.cy) return
    const opts = name === 'breadthfirst'
      ? { name, roots: this.findRootNodes(), directed: true, padding: 20 }
      : { name, padding: 20 }
    this.cy.layout(opts as Parameters<Core['layout']>[0]).run()
  }

  private findRootNodes(): string {
    return this.cy!.nodes().filter(n => n.indegree(false) === 0).map(n => `#${n.id()}`).join(', ')
  }

  exportGraph(): void {
    if (!this.cy) return
    const blob = this.cy.png({ output: 'blob', bg: 'white', full: true, scale: 2 }) as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'app-dependencies.png'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  private setupControls(): void {
    document.getElementById('app-deps-fit')?.addEventListener('click', () => this.cy?.fit())
    document.getElementById('app-deps-reset')?.addEventListener('click', () => this.resetHighlights())
    document.getElementById('app-deps-layout-hierarchy')?.addEventListener('click', () => this.applyLayout('breadthfirst'))
    document.getElementById('app-deps-layout-circle')?.addEventListener('click', () => this.applyLayout('circle'))
    document.getElementById('app-deps-export-png')?.addEventListener('click', () => this.exportGraph())
  }
}
