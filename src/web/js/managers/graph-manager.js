/**
 * Graph visualization managers
 * Handles module consumers graph and app dependencies graph
 */

/**
 * App Dependencies Graph Manager
 */
export const AppDependenciesGraphManager = {
    cy: null,
    appsData: null,
    showDetails: true,

    init(appsData) {
        this.appsData = appsData;
        this.initGraph();
        this.buildGraph();
        this.setupControls();
    },

    initGraph() {
        const container = document.getElementById('app-dependencies-graph');
        if (!container) return;

        this.cy = cytoscape({
            container: container,
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
                        'font-weight': 'bold'
                    }
                },
                {
                    selector: 'node:selected',
                    style: {
                        'border-width': 4,
                        'border-color': '#f39c12',
                        'border-style': 'solid'
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
                        'arrow-scale': 1.5
                    }
                },
                {
                    selector: 'edge.highlighted',
                    style: {
                        'width': 3,
                        'line-color': '#e74c3c',
                        'target-arrow-color': '#e74c3c',
                        'z-index': 999
                    }
                },
                {
                    selector: 'node.highlighted',
                    style: {
                        'border-width': 3,
                        'border-color': '#e74c3c',
                        'border-style': 'solid'
                    }
                },
                {
                    selector: 'node.faded',
                    style: {
                        'opacity': 0.3
                    }
                },
                {
                    selector: 'edge.faded',
                    style: {
                        'opacity': 0.2
                    }
                }
            ],
            layout: {
                name: 'breadthfirst',
                directed: true,
                padding: 50,
                spacingFactor: 1.5
            }
        });

        this.setupInteractions();
    },

    getNodeColor(platform) {
        if (platform === 'base') return '#2980b9';
        if (platform === 'complete') return '#27ae60';
        return '#e74c3c';
    },

    buildGraph() {
        if (!this.cy || !this.appsData) return;

        const nodes = [];
        const edges = [];
        const addedEdges = new Set();

        for (const [appName, appData] of Object.entries(this.appsData)) {
            nodes.push({
                group: 'nodes',
                data: {
                    id: appName,
                    label: appName,
                    color: this.getNodeColor(appData.platform),
                    platform: appData.platform,
                    version: appData.version,
                    description: appData.description,
                    moduleCount: (appData.modules || []).length,
                    uiModuleCount: (appData.uiModules || []).length,
                    dependencyCount: (appData.dependencies || []).length
                }
            });
        }

        for (const [appName, appData] of Object.entries(this.appsData)) {
            if (appData.dependencies && appData.dependencies.length > 0) {
                appData.dependencies.forEach(dep => {
                    const edgeId = `${appName}->${dep.name}`;
                    if (!addedEdges.has(edgeId)) {
                        edges.push({
                            group: 'edges',
                            data: {
                                id: edgeId,
                                source: appName,
                                target: dep.name,
                                version: dep.version
                            }
                        });
                        addedEdges.add(edgeId);
                    }
                });
            }
        }

        this.cy.add(nodes);
        this.cy.add(edges);
        this.applyLayout('breadthfirst');
    },

    setupInteractions() {
        if (!this.cy) return;

        let clickTimeout = null;

        this.cy.on('tap', 'node', (evt) => {
            const node = evt.target;

            if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
                this.focusOnNode(node);
                return;
            }

            clickTimeout = setTimeout(() => {
                clickTimeout = null;
                this.highlightDependencies(node);
            }, 300);
        });

        this.cy.on('tap', (evt) => {
            if (evt.target === this.cy) {
                this.resetHighlights();
            }
        });

        this.cy.on('mouseover', 'node', (evt) => {
            if (this.showDetails) {
                this.showNodeTooltip(evt.target, evt.originalEvent);
            }
        });

        this.cy.on('mouseout', 'node', () => {
            this.hideNodeTooltip();
        });
    },

    highlightDependencies(node) {
        this.cy.elements().removeClass('highlighted faded');
        node.addClass('highlighted');

        const outgoing = node.outgoers('edge');
        const dependencies = node.outgoers('node');
        const incoming = node.incomers('edge');
        const dependents = node.incomers('node');

        outgoing.addClass('highlighted');
        dependencies.addClass('highlighted');
        incoming.addClass('highlighted');
        dependents.addClass('highlighted');

        this.cy.elements().not(node).not(outgoing).not(dependencies).not(incoming).not(dependents).addClass('faded');
    },

    resetHighlights() {
        this.cy.elements().removeClass('highlighted faded');
    },

    focusOnNode(node) {
        this.cy.animate({
            fit: {
                eles: node.closedNeighborhood(),
                padding: 100
            },
            duration: 500
        });

        const originalColor = node.style('border-color');
        node.animate({
            style: {
                'border-width': 5,
                'border-color': '#f39c12'
            }
        }, {
            duration: 300,
            complete: () => {
                node.animate({
                    style: {
                        'border-width': 0
                    }
                }, {
                    duration: 300
                });
            }
        });
    },

    showNodeTooltip(node, event) {
        const data = node.data();
        const tooltip = document.createElement('div');
        tooltip.id = 'app-node-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            left: ${event.clientX + 15}px;
            top: ${event.clientY + 15}px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 10000;
            max-width: 300px;
            font-size: 13px;
            pointer-events: none;
        `;

        tooltip.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px; color: ${data.color};">${data.label}</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">${data.description || 'No description'}</div>
            <div style="border-top: 1px solid #eee; margin: 5px 0; padding-top: 5px;">
                <div><strong>Platform:</strong> ${data.platform}</div>
                <div><strong>Version:</strong> ${data.version || 'N/A'}</div>
                <div><strong>Backend Modules:</strong> ${data.moduleCount}</div>
                <div><strong>UI Modules:</strong> ${data.uiModuleCount}</div>
                <div><strong>Dependencies:</strong> ${data.dependencyCount}</div>
            </div>
        `;

        document.body.appendChild(tooltip);
    },

    hideNodeTooltip() {
        const tooltip = document.getElementById('app-node-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    },

    applyLayout(layoutName) {
        if (!this.cy) return;

        let layoutOptions = {
            name: layoutName,
            animate: true,
            animationDuration: 500,
            fit: true,
            padding: 50
        };

        if (layoutName === 'breadthfirst') {
            layoutOptions = {
                ...layoutOptions,
                directed: true,
                spacingFactor: 1.8,
                roots: this.findRootNodes()
            };
        } else if (layoutName === 'circle') {
            layoutOptions = {
                ...layoutOptions,
                spacingFactor: 1.5
            };
        }

        this.cy.layout(layoutOptions).run();
    },

    findRootNodes() {
        const roots = [];
        this.cy.nodes().forEach(node => {
            if (node.incomers('edge').length === 0) {
                roots.push('#' + node.id());
            }
        });
        return roots.length > 0 ? roots.join(',') : undefined;
    },

    setupControls() {
        document.getElementById('app-deps-fit')?.addEventListener('click', () => {
            if (this.cy) {
                this.cy.fit(null, 50);
            }
        });

        document.getElementById('app-deps-reset')?.addEventListener('click', () => {
            this.resetHighlights();
            this.applyLayout('breadthfirst');
        });

        document.getElementById('app-deps-layout-hierarchy')?.addEventListener('click', () => {
            this.applyLayout('breadthfirst');
        });

        document.getElementById('app-deps-layout-circle')?.addEventListener('click', () => {
            this.applyLayout('circle');
        });

        document.getElementById('app-deps-export-png')?.addEventListener('click', () => {
            this.exportGraph();
        });

        document.getElementById('app-deps-show-details')?.addEventListener('change', (e) => {
            this.showDetails = e.target.checked;
        });
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
        link.download = 'folio-app-dependencies.png';
        link.click();
    }
};
