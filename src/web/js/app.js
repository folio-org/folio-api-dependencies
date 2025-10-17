/**
 * Main application initialization and coordination
 */

import { AppState } from './core/state.js';
import { Utils } from './core/utils.js';
import { DropdownComponent } from './core/dropdown.js';
import { DataManager } from './managers/data-manager.js';
import { TableManager } from './managers/table-manager.js';
import { ApiManager, ApiUsageTableManager } from './managers/api-manager.js';
import { AppsManager } from './managers/apps-manager.js';
import { AppDependenciesGraphManager } from './managers/graph-manager.js';
import { ModuleGraphManager, addGraphControls } from './managers/module-consumers-graph.js';

/**
 * Main application controller
 */
export const App = {
    async init() {
        try {
            AppState.init();

            const rows = await DataManager.loadDependencies();
            AppState.allRows = rows;

            const appsData = await DataManager.loadApps();
            AppState.appsData = appsData;

            DataManager.buildModuleToAppsMap(appsData);
            AppState.globalApiIndex = DataManager.buildApiIndex(rows);

            this.initTable();
            this.initTableSearch();
            this.initApiSearch();
            this.initSorting();
            this.initTabs();
            this.initModuleConsumersGraph();

            AppsManager.init(appsData);
            this.initTableExport();
            this.initAppDependenciesGraph();

            TableManager.renderTable(AppState.allRows);
            ApiUsageTableManager.renderApiUsageCountTable(AppState.allRows);

            this.handleInitialApi();

        } catch (error) {
            console.error('Error initializing app:', error);
        }
    },

    initTable() {
        TableManager.renderTable(AppState.allRows);
    },

    initTableExport() {
        const exportBtn = document.getElementById('export-table-csv');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                TableManager.exportTableToCSV();
            });
        }
    },

    initAppDependenciesGraph() {
        if (typeof cytoscape === 'undefined') {
            console.error('Cytoscape.js library not loaded');
            const container = document.getElementById('app-dependencies-graph');
            if (container) {
                container.innerHTML = '<p style="color: red; padding: 20px;">Graph visualization library not loaded.</p>';
            }
            return;
        }

        const appDepsTab = document.querySelector('.tab-button[data-tab="app-dependencies"]');
        if (appDepsTab) {
            appDepsTab.addEventListener('click', () => {
                if (!AppDependenciesGraphManager.cy && AppState.appsData) {
                    setTimeout(() => {
                        AppDependenciesGraphManager.init(AppState.appsData);
                    }, 100);
                }
            });
        }
    },

    initTableSearch() {
        const uniqueValues = new Set();
        AppState.allRows.forEach(row => {
            uniqueValues.add(row.module);
            uniqueValues.add(row.api);
        });

        const tableDropdown = new DropdownComponent(
            AppState.elements.tableSearch,
            AppState.elements.tableDropdown,
            {
                onSelect: (value) => {
                    AppState.elements.tableClear.style.display = 'block';
                    const filteredRows = AppState.allRows.filter(
                        row => row.module === value || row.api === value
                    );
                    TableManager.renderTable(filteredRows);
                    this.updateMatchCount(filteredRows.length);
                }
            }
        );

        tableDropdown.setItems(Array.from(uniqueValues).sort());

        AppState.elements.tableClear.addEventListener('click', () => {
            AppState.elements.tableSearch.value = '';
            AppState.elements.tableClear.style.display = 'none';
            tableDropdown.hideDropdown();
            TableManager.renderTable(AppState.allRows);
            this.updateMatchCount(AppState.allRows.length);
        });

        this.updateMatchCount(AppState.allRows.length);
    },

    initApiSearch() {
        if (!AppState.globalApiIndex) {
            console.warn('API index not yet available');
            return;
        }

        const apis = Array.from(AppState.globalApiIndex.keys()).sort();

        const apiDropdown = new DropdownComponent(
            AppState.elements.apiSelect,
            AppState.elements.apiDropdown,
            {
                filterFn: (items, term) =>
                    items.filter(api => api.toLowerCase().startsWith(term.toLowerCase())),
                onSelect: (api) => ApiManager.selectApi(api)
            }
        );

        apiDropdown.setItems(apis);
    },

    initSorting() {
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.getAttribute('data-sort');
                const ascending = th.classList.toggle('asc');
                th.classList.remove('desc');
                if (!ascending) th.classList.add('desc');

                TableManager.sortTableBy(key, ascending);
            });
        });
    },

    initTabs() {
        const buttons = document.querySelectorAll('.tab-button');
        const views = document.querySelectorAll('.tab-view');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');

                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                views.forEach(view => {
                    view.id === 'view-' + tab
                        ? view.classList.add('active')
                        : view.classList.remove('active');
                });
            });
        });

        const defaultTab = document.querySelector('.tab-button.active');
        if (defaultTab) defaultTab.click();
    },

    initModuleConsumersGraph() {
        if (typeof cytoscape === 'undefined') {
            console.error('Cytoscape.js library not loaded');
            AppState.elements.moduleConsumersGraph.innerHTML =
                '<p style="color: red;">Graph visualization library not loaded. Please check that Cytoscape.js is included.</p>';
            return;
        }

        ModuleGraphManager.init();
        ModuleGraphManager.initGraph();
        addGraphControls(ModuleGraphManager);
    },

    updateMatchCount(count) {
        if (AppState.elements.tableMatchCount) {
            AppState.elements.tableMatchCount.textContent = count === AppState.allRows.length
                ? ''
                : `${count} matching ${count === 1 ? 'row' : 'rows'}`;
        }
    },

    handleInitialApi() {
        const initialApi = Utils.getQueryParam('api');
        if (initialApi) {
            const usageTabBtn = document.querySelector('.tab-button[data-tab="api"]');
            if (usageTabBtn) {
                usageTabBtn.click();
                setTimeout(() => {
                    ApiManager.selectApi(initialApi);
                }, 100);
            }
        }
    }
};

// Legacy function for backward compatibility
window.selectApi = function(api) {
    ApiManager.selectApi(api);
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
