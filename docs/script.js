// Global state management
const AppState = {
    allRows: [],
    currentGroupedRows: [],
    globalApiIndex: null,

    // Cache DOM elements
    elements: {
        tableSearch: null,
        tableClear: null,
        tableDropdown: null,
        tableMatchCount: null,
        apiSelect: null,
        apiDropdown: null,
        apiDetails: null,
        dependencyTableBody: null,
        moduleConsumersInput: null,
        moduleConsumersDropdown: null,
        moduleConsumersGraph: null
    },

    init() {
        // Cache DOM elements on initialization
        this.elements.tableSearch = document.getElementById('table-search');
        this.elements.tableClear = document.getElementById('table-clear');
        this.elements.tableDropdown = document.getElementById('table-dropdown');
        this.elements.tableMatchCount = document.getElementById('table-match-count');
        this.elements.apiSelect = document.getElementById('api-select');
        this.elements.apiDropdown = document.getElementById('api-dropdown');
        this.elements.apiDetails = document.getElementById('api-details');
        this.elements.dependencyTableBody = document.querySelector('#dependency-table tbody');
        this.elements.moduleConsumersInput = document.getElementById('module-consumers-input');
        this.elements.moduleConsumersDropdown = document.getElementById('module-consumers-dropdown');
        this.elements.moduleConsumersGraph = document.getElementById('module-consumers-graph');
    }
};

// Utility functions
const Utils = {
    getQueryParam(name) {
        return new URL(window.location.href).searchParams.get(name);
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    highlight(text, term) {
        if (!term) return text;
        const idx = text.toLowerCase().indexOf(term.toLowerCase());
        if (idx === -1) return text;
        return (
            text.slice(0, idx) +
            '<strong>' + text.slice(idx, idx + term.length) + '</strong>' +
            text.slice(idx + term.length)
        );
    },

    groupByModule(entries) {
        const grouped = {};
        for (const entry of entries) {
            if (!grouped[entry.module]) grouped[entry.module] = [];
            grouped[entry.module].push(entry.version || '?');
        }
        return Object.keys(grouped)
            .sort()
            .reduce((sorted, key) => {
                sorted[key] = grouped[key];
                return sorted;
            }, {});
    },

    isMismatch(requiredVersions, providedVersions) {
        if (!providedVersions.length) return true;
        return !requiredVersions.some(v => providedVersions.includes(v));
    }
};

// Dropdown component class for reusability
class DropdownComponent {
    constructor(input, dropdown, options = {}) {
        this.input = input;
        this.dropdown = dropdown;
        this.options = {
            filterFn: options.filterFn || ((items, term) =>
                items.filter(item => item.toLowerCase().includes(term.toLowerCase()))),
            onSelect: options.onSelect || (() => {}),
            highlightFn: options.highlightFn || Utils.highlight,
            ...options
        };

        this.filtered = [];
        this.activeIndex = -1;
        this.items = [];

        this.init();
    }

    init() {
        const debouncedUpdate = Utils.debounce(() => this.updateMatches(), 150);

        this.input.addEventListener('input', debouncedUpdate);
        this.input.addEventListener('focus', () => this.updateMatches());
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.hideDropdown();
            }
        });
    }

    setItems(items) {
        this.items = items;
    }

    updateMatches() {
        const term = this.input.value.trim();
        if (!term) {
            this.hideDropdown();
            return;
        }

        this.filtered = this.options.filterFn(this.items, term);
        this.activeIndex = -1;
        this.renderDropdown(term);
    }

    renderDropdown(term) {
        this.dropdown.innerHTML = '';
        if (this.filtered.length === 0) {
            this.hideDropdown();
            return;
        }

        const fragment = document.createDocumentFragment();
        this.filtered.forEach((item, i) => {
            const el = document.createElement('div');
            el.className = 'dropdown-item' + (i === this.activeIndex ? ' active' : '');
            el.innerHTML = this.options.highlightFn(item, term);
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.selectItem(item);
            });
            fragment.appendChild(el);
        });

        this.dropdown.appendChild(fragment);
        this.showDropdown();
    }

    selectItem(item) {
        this.input.value = item;
        this.hideDropdown();
        this.activeIndex = -1;
        this.options.onSelect(item);
    }

    handleKeydown(e) {
        if (this.dropdown.style.display === 'none') return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.activeIndex = Math.min(this.activeIndex + 1, this.filtered.length - 1);
                this.renderDropdown(this.input.value);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.activeIndex = Math.max(this.activeIndex - 1, 0);
                this.renderDropdown(this.input.value);
                break;
            case 'Enter':
                e.preventDefault();
                if (this.activeIndex >= 0) {
                    this.selectItem(this.filtered[this.activeIndex]);
                }
                break;
            case 'Escape':
                this.hideDropdown();
                break;
        }
    }

    showDropdown() {
        this.dropdown.style.display = 'block';
    }

    hideDropdown() {
        this.dropdown.style.display = 'none';
    }
}

// Data loading and processing
const DataManager = {
    async loadDependencies() {
        try {
            const response = await fetch('dependencies.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return this.processData(data);
        } catch (error) {
            console.error('Error loading dependencies:', error);
            return [];
        }
    },

    processData(data) {
        const rows = [];
        for (const moduleId in data) {
            const moduleData = data[moduleId];

            // Process provides
            if (moduleData.provides) {
                for (const p of moduleData.provides) {
                    rows.push({
                        module: moduleId,
                        type: 'provides',
                        api: p.id,
                        version: p.version || ''
                    });
                }
            }

            // Process requires and optional
            ['requires', 'optional'].forEach(depType => {
                if (moduleData[depType]) {
                    for (const r of moduleData[depType]) {
                        rows.push({
                            module: moduleId,
                            type: depType,
                            api: r.id,
                            version: r.version || ''
                        });
                    }
                }
            });
        }
        return rows;
    },

    buildApiIndex(rows) {
        const index = new Map();
        for (const row of rows) {
            if (!index.has(row.api)) {
                index.set(row.api, { provides: [], requires: [], optional: [] });
            }
            index.get(row.api)[row.type].push(row);
        }
        return index;
    }
};

// Table management
// Table management
const TableManager = {
    renderTable(rows) {
        const tbody = AppState.elements.dependencyTableBody;
        if (!tbody) return;

        tbody.innerHTML = '';
        const grouped = this.groupRows(rows);
        const groupedDisplayRows = [];

        const fragment = document.createDocumentFragment();
        for (const [key, versions] of grouped.entries()) {
            const [module, type, api] = key.split('|');
            const versionText = [...new Set(versions)].join(', ');

            groupedDisplayRows.push({ module, type, api, version: versionText });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${module}</td>
                <td class="type-${type}">${type}</td>
                <td>${api}</td>
                <td>${versionText}</td>
                <td>
                    <button class="view-usage-btn" data-api="${api}" title="View API usage details">
                        View Usage
                    </button>
                </td>
            `;
            fragment.appendChild(tr);
        }

        tbody.appendChild(fragment);
        AppState.currentGroupedRows = groupedDisplayRows;

        // Attach event listeners for View Usage buttons
        this.attachViewUsageListeners();
    },

    groupRows(rows) {
        const grouped = new Map();
        for (const row of rows) {
            const key = `${row.module}|${row.type}|${row.api}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(row.version || '?');
        }
        return grouped;
    },

    sortTableBy(column, ascending = true) {
        const rows = [...AppState.currentGroupedRows];
        rows.sort((a, b) => {
            const av = a[column]?.toLowerCase?.() ?? '';
            const bv = b[column]?.toLowerCase?.() ?? '';
            return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
        });

        this.renderSortedRows(rows);
    },

    renderSortedRows(rows) {
        const tbody = AppState.elements.dependencyTableBody;
        if (!tbody) return;

        tbody.innerHTML = '';
        const fragment = document.createDocumentFragment();

        for (const row of rows) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.module}</td>
                <td class="type-${row.type}">${row.type}</td>
                <td>${row.api}</td>
                <td>${row.version}</td>
                <td>
                    <button class="view-usage-btn" data-api="${row.api}" title="View API usage details">
                        View Usage
                    </button>
                </td>
            `;
            fragment.appendChild(tr);
        }

        tbody.appendChild(fragment);

        // Attach event listeners for View Usage buttons
        this.attachViewUsageListeners();
    },

    attachViewUsageListeners() {
        const tbody = AppState.elements.dependencyTableBody;
        if (!tbody) return;

        tbody.querySelectorAll('.view-usage-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const api = btn.getAttribute('data-api');
                this.redirectToApiUsage(api);
            });
        });
    },

    redirectToApiUsage(api) {
        // Switch to the API usage tab
        const apiUsageTabButton = document.querySelector('.tab-button[data-tab="api"]');
        if (apiUsageTabButton) {
            apiUsageTabButton.click();

            // Wait for DOM update and then populate the API search
            setTimeout(() => {
                const input = AppState.elements.apiSelect;
                if (input) {
                    input.value = api;
                    input.dispatchEvent(new Event('input'));
                    ApiManager.selectApi(api);
                }
            }, 50);
        }
    }
};

const ApiUsageTableManager = {
    currentData: [],
    currentSortColumn: 'count',
    currentSortAscending: false, // Default to descending for count

    renderApiUsageCountTable(rows) {
        const providesMap = new Map();
        const usageMap = new Map();

        for (const row of rows) {
            if (row.type === 'provides') {
                if (!providesMap.has(row.api)) {
                    providesMap.set(row.api, row.module);
                }
            } else if (row.type === 'requires' || row.type === 'optional') {
                if (!usageMap.has(row.api)) usageMap.set(row.api, new Set());
                usageMap.get(row.api).add(row.module);
            }
        }

        // Build and store the data
        this.currentData = Array.from(usageMap.entries())
            .map(([api, users]) => ({
                api,
                count: users.size,
                provider: providesMap.get(api) || null
            }));

        // Sort by default column
        this.sortData(this.currentSortColumn, this.currentSortAscending);
        this.renderTable();
    },

    sortData(column, ascending) {
        this.currentSortColumn = column;
        this.currentSortAscending = ascending;

        this.currentData.sort((a, b) => {
            let av, bv;

            if (column === 'count') {
                av = a.count;
                bv = b.count;
                // Numeric comparison
                return ascending ? av - bv : bv - av;
            } else if (column === 'api') {
                av = a.api.toLowerCase();
                bv = b.api.toLowerCase();
                // String comparison
                return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
            }

            return 0;
        });
    },

    renderTable() {
        const container = document.getElementById('api-usage-count');
        if (!container) return;

        container.innerHTML = `
            <table class="simple-table">
                <thead>
                    <tr>
                        <th data-sort-usage="api" class="${this.currentSortColumn === 'api' ? (this.currentSortAscending ? 'asc' : 'desc') : ''}">
                            API Interface
                        </th>
                        <th data-sort-usage="count" class="${this.currentSortColumn === 'count' ? (this.currentSortAscending ? 'asc' : 'desc') : ''}">
                            Usage Count
                        </th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${this.currentData.map(u => `
                        <tr>
                            <td>
                                ${u.provider
            ? `<a href="https://github.com/folio-org/${u.provider}" target="_blank">${u.api}</a>`
            : u.api}
                            </td>
                            <td>${u.count}</td>
                            <td>
                                <button class="view-usage-btn" data-api="${u.api}">View Usage</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Attach event listeners for sorting
        this.attachSortListeners();

        // Attach click events to "View Usage" buttons
        this.attachViewUsageListeners();
    },

    attachSortListeners() {
        const container = document.getElementById('api-usage-count');
        if (!container) return;

        container.querySelectorAll('th[data-sort-usage]').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.getAttribute('data-sort-usage');

                // Toggle sort direction if clicking the same column
                let ascending = true;
                if (this.currentSortColumn === column) {
                    ascending = !this.currentSortAscending;
                }

                // Clear all existing sort classes
                container.querySelectorAll('th[data-sort-usage]').forEach(header => {
                    header.classList.remove('asc', 'desc');
                });

                // Add appropriate class to clicked header
                th.classList.add(ascending ? 'asc' : 'desc');

                // Sort and re-render
                this.sortData(column, ascending);
                this.renderTable();
            });
        });
    },

    attachViewUsageListeners() {
        const container = document.getElementById('api-usage-count');
        if (!container) return;

        container.querySelectorAll('.view-usage-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const api = btn.getAttribute('data-api');
                const apiUsageTabButton = document.querySelector('.tab-button[data-tab="api"]');
                if (apiUsageTabButton) {
                    apiUsageTabButton.click();
                    setTimeout(() => {
                        const input = AppState.elements.apiSelect;
                        if (input) {
                            input.value = api;
                            input.dispatchEvent(new Event('input'));
                            ApiManager.selectApi(api);
                        }
                    }, 50);
                }
            });
        });
    }
};

// API management
const ApiManager = {
    currentApiData: null, // Store current API data for export

    selectApi(api) {
        const record = AppState.globalApiIndex.get(api.trim());
        if (record) {
            this.currentApiData = { api, record }; // Store for export
            AppState.elements.apiSelect.value = api;
            this.renderApiUsage(api, record);
            this.updateUrl(api);
        } else {
            console.warn('No match for API:', api);
            this.currentApiData = null;
            AppState.elements.apiDetails.innerHTML = '<em>No usage found</em>';
        }
    },

    renderApiUsage(apiId, data) {
        const div = AppState.elements.apiDetails;
        if (!div || !data) {
            if (div) div.innerHTML = `<p>No data for API <code>${apiId}</code></p>`;
            return;
        }

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1em;">
                <h3 style="margin: 0;">API: <code>${apiId}</code></h3>
                <button id="export-api-csv" class="export-csv-btn" title="Export API usage data to CSV">
                    📊 Export CSV
                </button>
            </div>
        `;

        // Provides section
        html += `<h4>✅ Provided by:</h4><ul>`;
        if (data.provides.length === 0) {
            html += `<li><em>No providers</em></li>`;
        } else {
            for (const p of data.provides) {
                html += `<li><code>${p.module}</code> (${p.version || 'n/a'})</li>`;
            }
        }
        html += `</ul>`;

        // Required section
        html += `<h4>🔍 Required by:</h4><ul>`;
        if (data.requires.length === 0) {
            html += `<li><em>No consumers</em></li>`;
        } else {
            const groupedRequires = Utils.groupByModule(data.requires);
            for (const mod in groupedRequires) {
                const versions = groupedRequires[mod].join(', ');
                const mismatch = Utils.isMismatch(groupedRequires[mod], data.provides.map(p => p.version));
                html += `<li><code>${mod}</code> (${versions})` +
                    (mismatch ? ` ⚠️ <span style="color: orange;">version mismatch</span>` : '') +
                    `</li>`;
            }
        }
        html += `</ul>`;

        // Optional section
        html += `<h4>🟡 Optionally used by:</h4><ul>`;
        if (data.optional.length === 0) {
            html += `<li><em>No optional users</em></li>`;
        } else {
            const groupedOptional = Utils.groupByModule(data.optional);
            for (const mod in groupedOptional) {
                const versions = groupedOptional[mod].join(', ');
                const mismatch = Utils.isMismatch(groupedOptional[mod], data.provides.map(p => p.version));
                html += `<li><code>${mod}</code> (${versions})` +
                    (mismatch ? ` ⚠️ <span style="color: orange;">version mismatch</span>` : '') +
                    `</li>`;
            }
        }
        html += `</ul>`;

        div.innerHTML = html;

        // Attach export button listener
        this.attachExportListener();
    },

    attachExportListener() {
        const exportBtn = document.getElementById('export-api-csv');
        if (exportBtn && this.currentApiData) {
            exportBtn.addEventListener('click', () => {
                this.exportApiUsageToCSV(this.currentApiData.api, this.currentApiData.record);
            });
        }
    },

    exportApiUsageToCSV(apiId, data) {
        if (!data) {
            console.warn('No data available for export');
            return;
        }

        // Prepare CSV data
        const csvRows = [];

        // CSV Header - simplified without version mismatch
        csvRows.push(['Module Name', 'API Versions', 'Dependency Type']);

        // Group data by module and dependency type, collecting all versions
        const moduleData = new Map();

        // Process required dependencies
        if (data.requires && data.requires.length > 0) {
            for (const consumer of data.requires) {
                const key = `${consumer.module}|required`;
                if (!moduleData.has(key)) {
                    moduleData.set(key, new Set());
                }
                moduleData.get(key).add(consumer.version || 'n/a');
            }
        }

        // Process optional dependencies
        if (data.optional && data.optional.length > 0) {
            for (const consumer of data.optional) {
                const key = `${consumer.module}|optional`;
                if (!moduleData.has(key)) {
                    moduleData.set(key, new Set());
                }
                moduleData.get(key).add(consumer.version || 'n/a');
            }
        }

        // Convert grouped data to CSV rows
        for (const [key, versions] of moduleData.entries()) {
            const [moduleName, dependencyType] = key.split('|');
            const versionList = Array.from(versions).sort().join(', ');

            csvRows.push([
                moduleName,
                versionList,
                dependencyType
            ]);
        }

        // Sort rows by module name, then by dependency type
        csvRows.slice(1).sort((a, b) => {
            const moduleCompare = a[0].localeCompare(b[0]);
            if (moduleCompare !== 0) return moduleCompare;
            return a[2].localeCompare(b[2]); // required comes before optional
        });

        // Convert to CSV format
        const csvContent = csvRows.map(row =>
            row.map(field => {
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                const stringField = String(field);
                if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                    return '"' + stringField.replace(/"/g, '""') + '"';
                }
                return stringField;
            }).join(',')
        ).join('\n');

        // Create and download the file
        this.downloadCSV(csvContent, `${apiId}_usage.csv`);
    },

    downloadCSV(csvContent, fileName) {
        try {
            // Create blob with UTF-8 BOM for proper Excel handling
            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csvContent], {
                type: 'text/csv;charset=utf-8;'
            });

            // Create download link
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';

            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up
            setTimeout(() => URL.revokeObjectURL(url), 100);

            console.log(`CSV exported: ${fileName}`);
        } catch (error) {
            console.error('Error exporting CSV:', error);
            alert('Error exporting CSV file. Please try again.');
        }
    },

    updateUrl(api) {
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('api', api);
        history.replaceState({}, '', newUrl);
    },

    renderApiUsageCountTable(rows) {
        // Delegate to the dedicated table manager
        ApiUsageTableManager.renderApiUsageCountTable(rows);
    }
};

// Main application initialization
const App = {
    async init() {
        try {
            AppState.init();

            const rows = await DataManager.loadDependencies();
            AppState.allRows = rows;

            // Build the API index FIRST, before initializing API search
            AppState.globalApiIndex = DataManager.buildApiIndex(rows);

            // Initialize components (order matters!)
            this.initTable();
            this.initTableSearch();
            this.initApiSearch(); // Now this will work because globalApiIndex exists
            this.initSorting();
            this.initTabs();
            this.initModuleConsumersGraph();

            // Render initial data
            TableManager.renderTable(AppState.allRows);
            ApiManager.renderApiUsageCountTable(AppState.allRows);

            // Handle initial API parameter
            this.handleInitialApi();

        } catch (error) {
            console.error('Error initializing app:', error);
        }
    },


    initTable() {
        TableManager.renderTable(AppState.allRows);
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

        // Clear button functionality
        AppState.elements.tableClear.addEventListener('click', () => {
            AppState.elements.tableSearch.value = '';
            AppState.elements.tableClear.style.display = 'none';
            tableDropdown.hideDropdown();
            TableManager.renderTable(AppState.allRows);
            this.updateMatchCount(AppState.allRows.length);
        });

        // Initial count
        this.updateMatchCount(AppState.allRows.length);
    },


    initApiSearch() {
        // Safety check
        if (!AppState.globalApiIndex) {
            console.warn('API index not yet available, skipping API search initialization');
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

        // Activate default tab
        const defaultTab = document.querySelector('.tab-button.active');
        if (defaultTab) defaultTab.click();
    },

    initModuleConsumersGraph() {
        const ModuleGraphManager = {
            cy: null,
            addedNodes: new Set(),
            providesMap: new Map(), // api → [providerModules]
            dependentsMap: new Map(), // api → [consumerModules]
            providesByModule: new Map(), // module → [apis]

            init() {
                this.buildLookupMaps();
                this.setupDropdown();
            },

            buildLookupMaps() {
                // Clear existing maps
                this.providesMap.clear();
                this.dependentsMap.clear();
                this.providesByModule.clear();

                // Build lookup maps from the data
                for (const row of AppState.allRows) {
                    if (row.type === 'provides') {
                        // Track which modules provide which APIs
                        if (!this.providesMap.has(row.api)) {
                            this.providesMap.set(row.api, []);
                        }
                        this.providesMap.get(row.api).push(row.module);

                        // Track which APIs each module provides
                        if (!this.providesByModule.has(row.module)) {
                            this.providesByModule.set(row.module, []);
                        }
                        this.providesByModule.get(row.module).push(row.api);
                    } else if (row.type === 'requires' || row.type === 'optional') {
                        // Track which modules depend on which APIs
                        if (!this.dependentsMap.has(row.api)) {
                            this.dependentsMap.set(row.api, []);
                        }
                        this.dependentsMap.get(row.api).push(row.module);
                    }
                }
            },

            setupDropdown() {
                const moduleNames = [...new Set(AppState.allRows.map(r => r.module))].sort();

                const moduleDropdown = new DropdownComponent(
                    AppState.elements.moduleConsumersInput,
                    AppState.elements.moduleConsumersDropdown,
                    {
                        filterFn: (items, term) =>
                            items.filter(m => m.toLowerCase().startsWith(term.toLowerCase())),
                        onSelect: (moduleName) => this.renderInitialGraph(moduleName)
                    }
                );

                moduleDropdown.setItems(moduleNames);
            },

            renderInitialGraph(moduleName) {
                try {
                    // Clear the graph container
                    AppState.elements.moduleConsumersGraph.innerHTML = '';

                    // Initialize Cytoscape
                    this.cy = cytoscape({
                        container: AppState.elements.moduleConsumersGraph,
                        elements: [
                            { data: { id: moduleName, label: moduleName } }
                        ],
                        layout: {
                            name: 'breadthfirst',
                            directed: true,
                            padding: 20,
                            spacingFactor: 1.5
                        },
                        style: [
                            {
                                selector: 'node',
                                style: {
                                    'label': 'data(label)',
                                    'background-color': '#1976d2',
                                    'color': '#fff',
                                    'text-valign': 'center',
                                    'text-halign': 'center',
                                    'font-size': '12px',
                                    'text-outline-color': '#1976d2',
                                    'text-outline-width': 2,
                                    'width': 'label',
                                    'height': 'label',
                                    'padding': '8px',
                                    'shape': 'roundrectangle'
                                }
                            },
                            {
                                selector: 'node:selected',
                                style: {
                                    'background-color': '#ff5722',
                                    'text-outline-color': '#ff5722'
                                }
                            },
                            {
                                selector: 'edge',
                                style: {
                                    'label': 'data(label)',
                                    'width': 2,
                                    'line-color': '#666',
                                    'target-arrow-color': '#666',
                                    'target-arrow-shape': 'triangle',
                                    'curve-style': 'bezier',
                                    'font-size': '10px',
                                    'text-rotation': 'autorotate',
                                    'text-margin-y': -8,
                                    'text-outline-color': '#fff',
                                    'text-outline-width': 1,
                                    'text-background-color': '#fff',
                                    'text-background-opacity': 0.8,
                                    'text-background-padding': '2px'
                                }
                            },
                            {
                                selector: 'edge[depType = "optional"]',
                                style: {
                                    'line-color': '#ff9800',
                                    'target-arrow-color': '#ff9800',
                                    'line-style': 'dashed'
                                }
                            },
                            {
                                selector: 'edge[depType = "requires"]',
                                style: {
                                    'line-color': '#4caf50',
                                    'target-arrow-color': '#4caf50',
                                    'line-style': 'solid'
                                }
                            }
                        ],
                        wheelSensitivity: 0.2,
                        minZoom: 0.1,
                        maxZoom: 3
                    });

                    // Clear tracking and expand the initial module
                    this.addedNodes.clear();
                    this.expandModule(moduleName);

                    // Add click handler for expanding nodes
                    this.cy.on('tap', 'node', (evt) => {
                        const node = evt.target;
                        this.expandModule(node.id());
                    });

                    // Add double-click to focus on a node
                    this.cy.on('dbltap', 'node', (evt) => {
                        const node = evt.target;
                        this.cy.animate({
                            fit: {
                                eles: node,
                                padding: 50
                            }
                        }, {
                            duration: 500
                        });
                    });

                } catch (error) {
                    console.error('Error initializing module consumers graph:', error);
                    AppState.elements.moduleConsumersGraph.innerHTML =
                        '<p style="color: red;">Error loading graph visualization. Please check console for details.</p>';
                }
            },

            expandModule(moduleName) {
                if (this.addedNodes.has(moduleName) || !this.cy) return;

                try {
                    // Add node if not yet present in graph
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
                            // Skip self-references
                            if (consumer === moduleName) continue;

                            // Add consumer node only if it doesn't exist yet
                            if (!this.cy.getElementById(consumer).length) {
                                this.cy.add({
                                    group: 'nodes',
                                    data: { id: consumer, label: consumer }
                                });
                            }

                            // Add edge only if it doesn't exist
                            const edgeId = `${consumer}__to__${moduleName}__${api}`;
                            if (!this.cy.getElementById(edgeId).length) {
                                // Determine dependency type
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

                    // Re-layout the graph
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

            // Add method to reset/clear the graph
            clearGraph() {
                if (this.cy) {
                    this.cy.destroy();
                    this.cy = null;
                }
                this.addedNodes.clear();
                AppState.elements.moduleConsumersGraph.innerHTML = '';
            },

            // Add method to export graph as image (bonus feature)
            exportGraph() {
                if (!this.cy) return;

                const png64 = this.cy.png({
                    output: 'blob',
                    bg: 'white',
                    full: true,
                    scale: 2
                });

                // Create download link
                const link = document.createElement('a');
                link.href = URL.createObjectURL(png64);
                link.download = 'module-dependencies.png';
                link.click();
            }
        };

        // Check if Cytoscape is available
        if (typeof cytoscape === 'undefined') {
            console.error('Cytoscape.js library not loaded');
            AppState.elements.moduleConsumersGraph.innerHTML =
                '<p style="color: red;">Graph visualization library not loaded. Please check that Cytoscape.js is included.</p>';
            return;
        }

        // Initialize the module graph manager
        ModuleGraphManager.init();

        // Optionally add control buttons
        this.addGraphControls(ModuleGraphManager);
    },

// Helper method to add control buttons for the graph
    addGraphControls(graphManager) {
        const graphContainer = AppState.elements.moduleConsumersGraph.parentElement;

        // Check if controls already exist
        if (graphContainer.querySelector('.graph-controls')) return;

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'graph-controls';
        controlsDiv.style.cssText = 'margin: 10px 0; display: flex; gap: 10px; flex-wrap: wrap;';

        controlsDiv.innerHTML = `
        <button id="fit-graph" class="graph-btn">Fit to View</button>
        <button id="reset-graph" class="graph-btn">Reset Graph</button>
        <button id="export-graph" class="graph-btn">Export PNG</button>
        <span style="margin-left: auto; font-size: 12px; color: #666;">
            Click nodes to expand • Double-click to focus • Mouse wheel to zoom
        </span>
    `;

        // Insert before the graph container
        graphContainer.insertBefore(controlsDiv, AppState.elements.moduleConsumersGraph);

        // Add event listeners
        document.getElementById('fit-graph')?.addEventListener('click', () => {
            if (graphManager.cy) {
                graphManager.cy.fit(null, 50);
            }
        });

        document.getElementById('reset-graph')?.addEventListener('click', () => {
            const input = AppState.elements.moduleConsumersInput;
            if (input && input.value) {
                graphManager.renderInitialGraph(input.value);
            }
        });

        document.getElementById('export-graph')?.addEventListener('click', () => {
            graphManager.exportGraph();
        });
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

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Legacy function for backward compatibility (if needed)
function selectApi(api) {
    ApiManager.selectApi(api);
}