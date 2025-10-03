// Global state management
const AppState = {
    allRows: [],
    currentGroupedRows: [],
    globalApiIndex: null,
    appsData: null,

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
        moduleConsumersGraph: null,
        appSearch: null,
        appClear: null,
        appsContainer: null
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
        this.elements.appSearch = document.getElementById('app-search');
        this.elements.appClear = document.getElementById('app-clear');
        this.elements.appsContainer = document.getElementById('apps-container');
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

    getMajorVersion(version) {
        if (!version || version === '?' || version === 'n/a') return null;
        const match = version.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    },

    // Check for version compatibility issues
    getVersionMismatchType(requiredVersions, providedVersions) {
        if (!providedVersions.length) return 'no-provider';

        // Check for exact matches first
        const hasExactMatch = requiredVersions.some(v => providedVersions.includes(v));
        if (hasExactMatch) return 'compatible';

        // Extract major versions
        const requiredMajors = requiredVersions
            .map(v => this.getMajorVersion(v))
            .filter(v => v !== null);
        const providedMajors = providedVersions
            .map(v => this.getMajorVersion(v))
            .filter(v => v !== null);

        if (requiredMajors.length === 0 || providedMajors.length === 0) {
            return 'version-format-issue';
        }

        // Check for major version compatibility
        const hasMajorMatch = requiredMajors.some(reqMajor =>
            providedMajors.some(provMajor => reqMajor === provMajor)
        );

        if (!hasMajorMatch) return 'major-mismatch';

        // Major versions match but exact versions don't
        return 'minor-mismatch';
    },

    // Legacy function for backward compatibility
    isMismatch(requiredVersions, providedVersions) {
        const mismatchType = this.getVersionMismatchType(requiredVersions, providedVersions);
        return mismatchType === 'major-mismatch';
    },

    // Get user-friendly mismatch message and styling
    getMismatchDisplay(mismatchType) {
        switch (mismatchType) {
            case 'compatible':
                return null; // No warning needed
            case 'major-mismatch':
                return {
                    icon: '⚠️',
                    text: 'major mismatch',
                    color: '#dc3545',
                    severity: 'error'
                };
            case 'minor-mismatch':
                return {
                    icon: '⚡',
                    text: 'minor mismatch',
                    color: '#ed930f',
                    severity: 'warning'
                };
            case 'no-provider':
                return {
                    icon: '❌',
                    text: 'no provider found',
                    color: '#dc3545',
                    severity: 'error'
                };
            case 'version-format-issue':
                return {
                    icon: '❓',
                    text: 'version format issue',
                    color: '#6c757d',
                    severity: 'info'
                };
            default:
                return null;
        }
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

    async loadApps() {
        try {
            const response = await fetch('apps.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading apps:', error);
            return {};
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


// Apps management
const AppsManager = {
    allApps: [],

    init(appsData) {
        this.allApps = Object.entries(appsData).map(([repoName, data]) => ({
            repoName,
            ...data
        }));

        this.renderApps(this.allApps);
        this.initSearch();
    },

    renderApps(apps) {
        const container = AppState.elements.appsContainer;
        if (!container) return;

        if (apps.length === 0) {
            container.innerHTML = '<p>No apps found.</p>';
            return;
        }

        const html = apps.map(app => this.renderAppCard(app)).join('');
        container.innerHTML = html;
    },

    renderAppCard(app) {
        const platformClass = app.platform === 'base' ? 'platform-base' : 'platform-complete';

        return `
            <div class="app-card">
                <h3>
                    <a href="https://github.com/folio-org/${app.repoName}" target="_blank" style="text-decoration: none; color: inherit;">
                        ${app.repoName}
                    </a>
                    <span class="app-platform ${platformClass}">${app.platform}</span>
                </h3>

                ${this.renderDependencies(app)}
                ${this.renderModules(app)}
                ${this.renderUiModules(app)}
            </div>
        `;
    },

    renderDependencies(app) {
        if (!app.dependencies || app.dependencies.length === 0) {
            return '<div class="app-section"><h4>📦 Dependencies</h4><div class="empty-section">No dependencies</div></div>';
        }

        const items = app.dependencies.map(dep => `
            <li>
                <code>${dep.name}</code>
                <span class="version">${dep.version}</span>
            </li>
        `).join('');

        return `
            <div class="app-section">
                <h4>📦 Dependencies (${app.dependencies.length})</h4>
                <ul class="app-list dependencies">${items}</ul>
            </div>
        `;
    },

    renderModules(app) {
        if (!app.modules || app.modules.length === 0) {
            return '<div class="app-section"><h4>⚙️ Backend Modules</h4><div class="empty-section">No modules</div></div>';
        }

        const items = app.modules.map(mod => `
            <li>
                <code>${mod.name}</code>
                <span class="version">${mod.version}</span>
            </li>
        `).join('');

        return `
            <div class="app-section">
                <h4>⚙️ Backend Modules (${app.modules.length})</h4>
                <ul class="app-list modules">${items}</ul>
            </div>
        `;
    },

    renderUiModules(app) {
        if (!app.uiModules || app.uiModules.length === 0) {
            return '<div class="app-section"><h4>🎨 UI Modules</h4><div class="empty-section">No UI modules</div></div>';
        }

        const items = app.uiModules.map(ui => `
            <li>
                <code>${ui.name}</code>
                <span class="version">${ui.version}</span>
            </li>
        `).join('');

        return `
            <div class="app-section">
                <h4>🎨 UI Modules (${app.uiModules.length})</h4>
                <ul class="app-list ui-modules">${items}</ul>
            </div>
        `;
    },

    initSearch() {
        const searchInput = AppState.elements.appSearch;
        const clearBtn = AppState.elements.appClear;

        if (!searchInput || !clearBtn) return;

        const debouncedSearch = Utils.debounce(() => {
            const term = searchInput.value.trim().toLowerCase();

            if (term) {
                clearBtn.style.display = 'block';
                const filtered = this.allApps.filter(app =>
                    app.repoName.toLowerCase().includes(term) ||
                    (app.description && app.description.toLowerCase().includes(term)) ||
                    (app.modules && app.modules.some(m => m.name.toLowerCase().includes(term))) ||
                    (app.uiModules && app.uiModules.some(u => u.name.toLowerCase().includes(term)))
                );
                this.renderApps(filtered);
            } else {
                clearBtn.style.display = 'none';
                this.renderApps(this.allApps);
            }
        }, 300);

        searchInput.addEventListener('input', debouncedSearch);

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            this.renderApps(this.allApps);
        });
    }
};

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
    showVersionMismatch: false, // Default to disabled

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

    initVersionMismatchToggle() {
        const toggleBtn = document.getElementById('toggle-version-warnings');
        if (toggleBtn) {
            // Add event listener
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showVersionMismatch = !this.showVersionMismatch;

                // Update button appearance
                this.updateToggleButton(toggleBtn);

                // Re-render current API if one is selected
                if (this.currentApiData) {
                    this.renderApiUsage(this.currentApiData.api, this.currentApiData.record);
                }
            });
        }
    },

    updateToggleButton(button) {
        if (this.showVersionMismatch) {
            button.textContent = '⚠️ Hide Warnings';
            button.style.backgroundColor = '#ffc107';
            button.style.color = '#000';
            button.title = 'Hide version mismatch warnings';
        } else {
            button.textContent = '👁️ Show Warnings';
            button.style.backgroundColor = '#6c757d';
            button.style.color = '#fff';
            button.title = 'Show version mismatch warnings';
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
                <div style="display: flex; align-items: center; gap: 12px;">
                    <button id="toggle-version-warnings" style="
                        padding: 6px 12px; 
                        border: none; 
                        border-radius: 4px; 
                        cursor: pointer; 
                        font-size: 14px;
                        transition: all 0.2s ease;
                    " title="${this.showVersionMismatch ? 'Hide version mismatch warnings' : 'Show version mismatch warnings'}">
                        ${this.showVersionMismatch ? '⚠️ Hide Warnings' : '👁️ Show Warnings'}
                    </button>
                    <button id="export-api-csv" class="export-csv-btn" title="Export API usage data to CSV">
                        📊 Export CSV
                    </button>
                </div>
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
            const providedVersions = data.provides.map(p => p.version);

            for (const mod in groupedRequires) {
                const versions = groupedRequires[mod].join(', ');
                html += `<li><code>${mod}</code> (${versions})`;

                // Only show version mismatch if enabled
                if (this.showVersionMismatch) {
                    const mismatchType = Utils.getVersionMismatchType(groupedRequires[mod], providedVersions);
                    const mismatchDisplay = Utils.getMismatchDisplay(mismatchType);

                    if (mismatchDisplay) {
                        html += ` ${mismatchDisplay.icon} <span style="color: ${mismatchDisplay.color};">${mismatchDisplay.text}</span>`;
                    }
                }

                html += `</li>`;
            }
        }
        html += `</ul>`;

        // Optional section
        html += `<h4>🟡 Optionally used by:</h4><ul>`;
        if (data.optional.length === 0) {
            html += `<li><em>No optional users</em></li>`;
        } else {
            const groupedOptional = Utils.groupByModule(data.optional);
            const providedVersions = data.provides.map(p => p.version);

            for (const mod in groupedOptional) {
                const versions = groupedOptional[mod].join(', ');
                html += `<li><code>${mod}</code> (${versions})`;

                // Only show version mismatch if enabled
                if (this.showVersionMismatch) {
                    const mismatchType = Utils.getVersionMismatchType(groupedOptional[mod], providedVersions);
                    const mismatchDisplay = Utils.getMismatchDisplay(mismatchType);

                    if (mismatchDisplay) {
                        html += ` ${mismatchDisplay.icon} <span style="color: ${mismatchDisplay.color};">${mismatchDisplay.text}</span>`;
                    }
                }

                html += `</li>`;
            }
        }
        html += `</ul>`;

        div.innerHTML = html;

        // Apply initial button styling and attach listeners
        const toggleBtn = document.getElementById('toggle-version-warnings');
        if (toggleBtn) {
            this.updateToggleButton(toggleBtn);
        }

        // Attach both export button and toggle button listeners
        this.attachExportListener();
        this.initVersionMismatchToggle();
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

            // Load apps data
            const appsData = await DataManager.loadApps();
            AppState.appsData = appsData;

            // Initialize components (order matters!)
            this.initTable();
            this.initTableSearch();
            this.initApiSearch(); // Now this will work because globalApiIndex exists
            this.initSorting();
            this.initTabs();
            this.initModuleConsumersGraph();

            // Initialize apps view
            AppsManager.init(appsData);

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
            selectedModules: new Set(), // Only new addition for tracking multiple modules
            providesMap: new Map(), // api → [providerModules]
            dependentsMap: new Map(), // api → [consumerModules]
            providesByModule: new Map(), // module → [apis]
            deselectMode: false,

            init() {
                this.buildLookupMaps();
                this.setupDropdown();
            },

            buildLookupMaps() {
                // Clear existing maps
                this.providesMap.clear();
                this.dependentsMap.clear();
                this.providesByModule.clear();

                // Build lookup maps from allRows
                AppState.allRows.forEach(row => {
                    if (row.type === 'provides') {
                        // Map API to providers
                        if (!this.providesMap.has(row.api)) {
                            this.providesMap.set(row.api, []);
                        }
                        this.providesMap.get(row.api).push(row.module);

                        // Map module to provided APIs
                        if (!this.providesByModule.has(row.module)) {
                            this.providesByModule.set(row.module, []);
                        }
                        this.providesByModule.get(row.module).push(row.api);
                    } else if (row.type === 'requires' || row.type === 'optional') {
                        // Map API to consumers
                        if (!this.dependentsMap.has(row.api)) {
                            this.dependentsMap.set(row.api, []);
                        }
                        this.dependentsMap.get(row.api).push(row.module);
                    }
                });
            },

            // Add method to toggle deselect mode
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

            // Add method to deselect a module
            // Add method to deselect a module and its related modules
            deselectModule(moduleId) {
                if (!this.cy) return;

                // Get the node to be deselected
                const node = this.cy.getElementById(moduleId);
                if (!node.length) return;

                // Find all nodes that should be removed (connected nodes)
                const nodesToRemove = new Set();
                nodesToRemove.add(moduleId);

                // Get all connected nodes through edges
                const connectedEdges = node.connectedEdges();
                connectedEdges.forEach(edge => {
                    const sourceId = edge.source().id();
                    const targetId = edge.target().id();

                    // Add both source and target to removal list
                    nodesToRemove.add(sourceId);
                    nodesToRemove.add(targetId);
                });

                // However, keep nodes that are still selected as primary modules
                // or have connections to other primary modules that aren't being removed
                const nodesToKeep = new Set();

                // Check each node to see if it should be kept
                nodesToRemove.forEach(nodeId => {
                    // If it's a primary selected module (and not the one being deselected), keep it
                    if (this.selectedModules.has(nodeId) && nodeId !== moduleId) {
                        nodesToKeep.add(nodeId);
                        return;
                    }

                    // Check if this node has connections to modules that will remain
                    const nodeToCheck = this.cy.getElementById(nodeId);
                    if (nodeToCheck.length) {
                        const nodeEdges = nodeToCheck.connectedEdges();
                        let hasConnectionToKeep = false;

                        nodeEdges.forEach(edge => {
                            const otherNodeId = edge.source().id() === nodeId ?
                                edge.target().id() : edge.source().id();

                            // If connected to a primary module that's not being removed, keep this node
                            if (this.selectedModules.has(otherNodeId) && otherNodeId !== moduleId) {
                                hasConnectionToKeep = true;
                            }
                        });

                        if (hasConnectionToKeep) {
                            nodesToKeep.add(nodeId);
                        }
                    }
                });

                // Remove nodes that shouldn't be kept
                const finalNodesToRemove = Array.from(nodesToRemove).filter(nodeId =>
                    !nodesToKeep.has(nodeId)
                );

                // Remove from tracking sets
                finalNodesToRemove.forEach(nodeId => {
                    this.selectedModules.delete(nodeId);
                    this.addedNodes.delete(nodeId);
                });

                // Remove nodes from graph
                finalNodesToRemove.forEach(nodeId => {
                    const nodeToRemove = this.cy.getElementById(nodeId);
                    if (nodeToRemove.length) {
                        this.cy.remove(nodeToRemove);
                    }
                });

                // Re-layout the graph if nodes remain
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
                            // Modified to support multiple modules
                            this.selectedModules.add(module);
                            this.expandModule(module);
                            // Don't clear input to allow adding more modules
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

                // Add click handlers for nodes
                let clickTimeout = null;

                this.cy.on('tap', 'node', (evt) => {
                    const node = evt.target;
                    const moduleId = node.id();

                    // Check if in deselect mode
                    if (this.deselectMode) {
                        this.deselectModule(moduleId);
                        return;
                    }

                    // Clear any existing timeout
                    if (clickTimeout) {
                        clearTimeout(clickTimeout);
                        clickTimeout = null;
                        // This is a double-click - focus on the node
                        this.focusOnNode(node);
                        return;
                    }

                    // Set timeout for single click
                    clickTimeout = setTimeout(() => {
                        clickTimeout = null;
                        // Single click - expand the module
                        if (!this.selectedModules.has(moduleId)) {
                            this.selectedModules.add(moduleId);
                            this.expandModule(moduleId);
                        }
                    }, 300); // 300ms delay to detect double-click
                });

                // Update node appearance when in deselect mode
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

                // Animate to focus on the clicked node
                this.cy.animate({
                    fit: {
                        eles: node,
                        padding: 100
                    },
                    duration: 500
                });

                // Optional: Highlight the focused node temporarily
                const originalColor = node.style('background-color');
                node.animate({
                    style: {
                        'background-color': '#28a745'
                    }
                }, {
                    duration: 200,
                    complete: () => {
                        // Animate back to original color
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
            },

            showDependencies(dependencyType) {
                if (!this.cy || this.selectedModules.size === 0) return;

                // Get all currently selected modules
                const currentModules = Array.from(this.selectedModules);

                for (const moduleName of currentModules) {
                    // Find all dependencies of this module (APIs it requires/optional)
                    const moduleDependencies = AppState.allRows.filter(row =>
                        row.module === moduleName && row.type === dependencyType
                    );

                    for (const dep of moduleDependencies) {
                        const api = dep.api;

                        // Find modules that provide this API
                        const providers = this.providesMap.get(api) || [];

                        for (const provider of providers) {
                            // Skip if provider is the same as consumer
                            if (provider === moduleName) continue;

                            // Add provider node if it doesn't exist
                            if (!this.cy.getElementById(provider).length) {
                                this.cy.add({
                                    group: 'nodes',
                                    data: { id: provider, label: provider }
                                });
                            }

                            // Add edge from current module to provider
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

                            // Mark provider as added so it can be expanded later
                            this.addedNodes.add(provider);
                        }
                    }
                }

                // Re-layout the graph
                this.cy.layout({
                    name: 'breadthfirst',
                    directed: true,
                    padding: 30,
                    spacingFactor: 1.8,
                    animate: true,
                    animationDuration: 500
                }).run();
            },
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
        ModuleGraphManager.initGraph();

        this.addGraphControls(ModuleGraphManager)
    },

// Helper method to add control buttons for the graph
    addGraphControls(graphManager) {
        const graphContainer = AppState.elements.moduleConsumersGraph.parentElement;

        // Check if controls already exist
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

        // Insert before the graph container
        graphContainer.insertBefore(controlsDiv, AppState.elements.moduleConsumersGraph);

        // Add event listeners
        document.getElementById('fit-graph')?.addEventListener('click', () => {
            if (graphManager.cy) {
                graphManager.cy.fit(null, 50);
            }
        });

        document.getElementById('reset-graph')?.addEventListener('click', () => {
            // Clear the graph and reset all state
            graphManager.selectedModules.clear();
            graphManager.addedNodes.clear();
            graphManager.deselectMode = false;

            // Update deselect button appearance
            const deselectBtn = document.getElementById('deselect-mode');
            if (deselectBtn) {
                deselectBtn.textContent = 'Toggle Deselect Mode';
                deselectBtn.style.backgroundColor = '';
            }

            if (graphManager.cy) {
                graphManager.cy.elements().remove(); // Remove all nodes and edges
            }

            // Clear the input field
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