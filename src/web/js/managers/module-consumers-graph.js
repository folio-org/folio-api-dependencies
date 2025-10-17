import { AppState } from '../core/state.js';
import { DropdownComponent } from '../core/dropdown.js';

/**
 * Module Consumers Graph Manager
 * Handles the interactive module dependency graph
 */
export const ModuleGraphManager = {
    cy: null,
    addedNodes: new Set(),
    selectedModules: new Set(),
    providesMap: new Map(),
    dependentsMap: new Map(),
    providesByModule: new Map(),
    deselectMode: false,

    init() {
        this.buildLookupMaps();
        this.setupDropdown();
    },

    buildLookupMaps() {
        this.providesMap.clear();
        this.dependentsMap.clear();
        this.providesByModule.clear();

        AppState.allRows.forEach(row => {
            if (row.type === 'provides') {
                if (!this.providesMap.has(row.api)) {
                    this.providesMap.set(row.api, []);
                }
                this.providesMap.get(row.api).push(row.module);

                if (!this.providesByModule.has(row.module)) {
                    this.providesByModule.set(row.module, []);
                }
                this.providesByModule.get(row.module).push(row.api);
            } else if (row.type === 'requires' || row.type === 'optional') {
                if (!this.dependentsMap.has(row.api)) {
                    this.dependentsMap.set(row.api, []);
                }
                this.dependentsMap.get(row.api).push(row.module);
            }
        });
    },

    toggleDeselectMode() {
        this.deselectMode = !this.deselectMode;
        const deselectBtn = document.getElementById('deselect-mode');
        if (deselectBtn) {
            if (this.deselectMode) {
                deselectBtn.textContent = 'Exit Deselect Mode';
                deselectBtn.style.backgroundColor = '#dc3545';
                deselectBtn.style.color = 'white';
            } else {
                deselectBtn.textContent = 'Toggle Deselect Mode';
                deselectBtn.style.backgroundColor = '';
                deselectBtn.style.color = '';
            }
        }
    },

    deselectModule(moduleId) {
        if (!this.cy) return;

        const node = this.cy.getElementById(moduleId);
        if (!node.length) return;

        const nodesToRemove = new Set();
        nodesToRemove.add(moduleId);

        const connectedEdges = node.connectedEdges();
        connectedEdges.forEach(edge => {
            const sourceId = edge.source().id();
            const targetId = edge.target().id();
            nodesToRemove.add(sourceId);
            nodesToRemove.add(targetId);
        });

        const nodesToKeep = new Set();

        nodesToRemove.forEach(nodeId => {
            if (this.selectedModules.has(nodeId) && nodeId !== moduleId) {
                nodesToKeep.add(nodeId);
                return;
            }

            const nodeToCheck = this.cy.getElementById(nodeId);
            if (nodeToCheck.length) {
                const nodeEdges = nodeToCheck.connectedEdges();
                let hasConnectionToKeep = false;

                nodeEdges.forEach(edge => {
                    const otherNodeId = edge.source().id() === nodeId ?
                        edge.target().id() : edge.source().id();

                    if (this.selectedModules.has(otherNodeId) && otherNodeId !== moduleId) {
                        hasConnectionToKeep = true;
                    }
                });

                if (hasConnectionToKeep) {
                    nodesToKeep.add(nodeId);
                }
            }
        });

        const finalNodesToRemove = Array.from(nodesToRemove).filter(nodeId =>
            !nodesToKeep.has(nodeId)
        );

        finalNodesToRemove.forEach(nodeId => {
            this.selectedModules.delete(nodeId);
            this.addedNodes.delete(nodeId);
        });

        finalNodesToRemove.forEach(nodeId => {
            const nodeToRemove = this.cy.getElementById(nodeId);
            if (nodeToRemove.length) {
                this.cy.remove(nodeToRemove);
            }
        });

        if (this.cy.nodes().length > 0) {
            this.cy.layout({
                name: 'breadthfirst',
                directed: true,
                padding: 30,
                spacingFactor: 1.8,
                animate: true,
                animationDuration: 500
            }).run();
        }
    },

    setupDropdown() {
        const modules = Array.from(this.providesByModule.keys()).sort();

        const moduleDropdown = new DropdownComponent(
            AppState.elements.moduleConsumersInput,
            AppState.elements.moduleConsumersDropdown,
            {
                onSelect: (module) => {
                    this.selectedModules.add(module);
                    this.expandModule(module);
                }
            }
        );

        moduleDropdown.setItems(modules);
    },

    initGraph() {
        const container = AppState.elements.moduleConsumersGraph;
        if (!container) return;

        this.cy = cytoscape({
            container: container,
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
                        'text-max-width': '130px'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#666',
                        'target-arrow-color': '#666',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'label': 'data(label)',
                        'font-size': '10px',
                        'text-rotation': 'autorotate'
                    }
                },
                {
                    selector: 'edge[depType="optional"]',
                    style: {
                        'line-style': 'dashed',
                        'line-color': '#ffc107',
                        'target-arrow-color': '#ffc107'
                    }
                }
            ],
            layout: {
                name: 'breadthfirst',
                directed: true,
                padding: 30,
                spacingFactor: 1.8
            }
        });

        let clickTimeout = null;

        this.cy.on('tap', 'node', (evt) => {
            const node = evt.target;
            const moduleId = node.id();

            if (this.deselectMode) {
                this.deselectModule(moduleId);
                return;
            }

            if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
                this.focusOnNode(node);
                return;
            }

            clickTimeout = setTimeout(() => {
                clickTimeout = null;
                if (!this.selectedModules.has(moduleId)) {
                    this.selectedModules.add(moduleId);
                    this.expandModule(moduleId);
                }
            }, 300);
        });

        this.cy.on('mouseover', 'node', (evt) => {
            if (this.deselectMode) {
                evt.target.addClass('deselect-mode');
            }
        });

        this.cy.on('mouseout', 'node', (evt) => {
            if (this.deselectMode) {
                evt.target.removeClass('deselect-mode');
            }
        });
    },

    focusOnNode(node) {
        if (!this.cy || !node) return;

        this.cy.animate({
            fit: {
                eles: node,
                padding: 100
            },
            duration: 500
        });

        const originalColor = node.style('background-color');
        node.animate({
            style: {
                'background-color': '#28a745'
            }
        }, {
            duration: 200,
            complete: () => {
                node.animate({
                    style: {
                        'background-color': originalColor
                    }
                }, {
                    duration: 200
                });
            }
        });
    },

    expandModule(moduleName) {
        if (this.addedNodes.has(moduleName) || !this.cy) return;

        try {
            if (!this.cy.getElementById(moduleName).length) {
                this.cy.add({
                    group: 'nodes',
                    data: { id: moduleName, label: moduleName }
                });
            }

            this.addedNodes.add(moduleName);

            const providedApis = this.providesByModule.get(moduleName) || [];

            for (const api of providedApis) {
                const consumers = this.dependentsMap.get(api) || [];

                for (const consumer of consumers) {
                    if (consumer === moduleName) continue;

                    if (!this.cy.getElementById(consumer).length) {
                        this.cy.add({
                            group: 'nodes',
                            data: { id: consumer, label: consumer }
                        });
                    }

                    const edgeId = `${consumer}__to__${moduleName}__${api}`;
                    if (!this.cy.getElementById(edgeId).length) {
                        const isOptional = AppState.allRows.some(
                            r => r.module === consumer && r.api === api && r.type === 'optional'
                        );

                        this.cy.add({
                            group: 'edges',
                            data: {
                                id: edgeId,
                                source: consumer,
                                target: moduleName,
                                label: `${api}${isOptional ? ' (opt)' : ''}`,
                                depType: isOptional ? 'optional' : 'requires'
                            }
                        });
                    }
                }
            }

            this.cy.layout({
                name: 'breadthfirst',
                directed: true,
                padding: 20,
                spacingFactor: 1.5,
                animate: true,
                animationDuration: 500
            }).run();

        } catch (error) {
            console.error('Error expanding module:', moduleName, error);
        }
    },

    clearGraph() {
        if (this.cy) {
            this.cy.destroy();
            this.cy = null;
        }
        this.addedNodes.clear();
        AppState.elements.moduleConsumersGraph.innerHTML = '';
    },

    exportGraph() {
        if (!this.cy) return;

        const png64 = this.cy.png({
            output: 'blob',
            bg: 'white',
            full: true,
            scale: 2
        });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(png64);
        link.download = 'module-dependencies.png';
        link.click();
    },

    showDependencies(dependencyType) {
        if (!this.cy || this.selectedModules.size === 0) return;

        const currentModules = Array.from(this.selectedModules);

        for (const moduleName of currentModules) {
            const moduleDependencies = AppState.allRows.filter(row =>
                row.module === moduleName && row.type === dependencyType
            );

            for (const dep of moduleDependencies) {
                const api = dep.api;
                const providers = this.providesMap.get(api) || [];

                for (const provider of providers) {
                    if (provider === moduleName) continue;

                    if (!this.cy.getElementById(provider).length) {
                        this.cy.add({
                            group: 'nodes',
                            data: { id: provider, label: provider }
                        });
                    }

                    const edgeId = `${moduleName}__depends_on__${provider}__${api}`;
                    if (!this.cy.getElementById(edgeId).length) {
                        this.cy.add({
                            group: 'edges',
                            data: {
                                id: edgeId,
                                source: moduleName,
                                target: provider,
                                label: `${api}${dependencyType === 'optional' ? ' (opt)' : ''}`,
                                depType: dependencyType
                            }
                        });
                    }

                    this.addedNodes.add(provider);
                }
            }
        }

        this.cy.layout({
            name: 'breadthfirst',
            directed: true,
            padding: 30,
            spacingFactor: 1.8,
            animate: true,
            animationDuration: 500
        }).run();
    }
};

/**
 * Add graph controls to UI
 */
export function addGraphControls(graphManager) {
    const graphContainer = AppState.elements.moduleConsumersGraph.parentElement;

    if (graphContainer.querySelector('.graph-controls')) return;

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'graph-controls';
    controlsDiv.style.cssText = 'margin: 10px 0; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;';

    controlsDiv.innerHTML = `
        <button id="fit-graph" class="graph-btn">Fit to View</button>
        <button id="reset-graph" class="graph-btn">Reset Graph</button>
        <button id="show-required-deps" class="graph-btn">Show Required Dependencies</button>
        <button id="show-optional-deps" class="graph-btn">Show Optional Dependencies</button>
        <button id="deselect-mode" class="graph-btn">Toggle Deselect Mode</button>
        <button id="export-graph" class="graph-btn">Export PNG</button>
        <span style="margin-left: auto; font-size: 12px; color: #666;">
            Click nodes to expand • Double-click to focus • Ctrl+click to deselect • Mouse wheel to zoom
        </span>
    `;

    graphContainer.insertBefore(controlsDiv, AppState.elements.moduleConsumersGraph);

    document.getElementById('fit-graph')?.addEventListener('click', () => {
        if (graphManager.cy) {
            graphManager.cy.fit(null, 50);
        }
    });

    document.getElementById('reset-graph')?.addEventListener('click', () => {
        graphManager.selectedModules.clear();
        graphManager.addedNodes.clear();
        graphManager.deselectMode = false;

        const deselectBtn = document.getElementById('deselect-mode');
        if (deselectBtn) {
            deselectBtn.textContent = 'Toggle Deselect Mode';
            deselectBtn.style.backgroundColor = '';
        }

        if (graphManager.cy) {
            graphManager.cy.elements().remove();
        }

        const input = AppState.elements.moduleConsumersInput;
        if (input) {
            input.value = '';
        }
    });

    document.getElementById('show-required-deps')?.addEventListener('click', () => {
        graphManager.showDependencies('requires');
    });

    document.getElementById('show-optional-deps')?.addEventListener('click', () => {
        graphManager.showDependencies('optional');
    });

    document.getElementById('deselect-mode')?.addEventListener('click', () => {
        graphManager.toggleDeselectMode();
    });

    document.getElementById('export-graph')?.addEventListener('click', () => {
        graphManager.exportGraph();
    });
}
