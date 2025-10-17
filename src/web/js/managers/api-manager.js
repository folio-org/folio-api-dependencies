import { AppState } from '../core/state.js';
import { Utils } from '../core/utils.js';

/**
 * API usage management and rendering
 */
export const ApiManager = {
    currentApiData: null,
    showVersionMismatch: false,

    /**
     * Select and display API usage
     * @param {string} api - API name
     */
    selectApi(api) {
        const record = AppState.globalApiIndex.get(api.trim());
        if (record) {
            this.currentApiData = { api, record };
            AppState.elements.apiSelect.value = api;
            this.renderApiUsage(api, record);
            this.updateUrl(api);
        } else {
            console.warn('No match for API:', api);
            this.currentApiData = null;
            AppState.elements.apiDetails.innerHTML = '<em>No usage found</em>';
        }
    },

    /**
     * Initialize version mismatch toggle
     */
    initVersionMismatchToggle() {
        const toggleBtn = document.getElementById('toggle-version-warnings');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showVersionMismatch = !this.showVersionMismatch;
                this.updateToggleButton(toggleBtn);

                if (this.currentApiData) {
                    this.renderApiUsage(this.currentApiData.api, this.currentApiData.record);
                }
            });
        }
    },

    /**
     * Update toggle button appearance
     * @param {HTMLElement} button - Toggle button element
     */
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

    /**
     * Render API usage details
     * @param {string} apiId - API identifier
     * @param {Object} data - API usage data
     */
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

        const toggleBtn = document.getElementById('toggle-version-warnings');
        if (toggleBtn) {
            this.updateToggleButton(toggleBtn);
        }

        this.attachExportListener();
        this.initVersionMismatchToggle();
    },

    /**
     * Attach export button listener
     */
    attachExportListener() {
        const exportBtn = document.getElementById('export-api-csv');
        if (exportBtn && this.currentApiData) {
            exportBtn.addEventListener('click', () => {
                this.exportApiUsageToCSV(this.currentApiData.api, this.currentApiData.record);
            });
        }
    },

    /**
     * Export API usage to CSV
     * @param {string} apiId - API identifier
     * @param {Object} data - API usage data
     */
    exportApiUsageToCSV(apiId, data) {
        if (!data) {
            console.warn('No data available for export');
            return;
        }

        const csvRows = [];
        csvRows.push(['Module Name', 'API Versions', 'Dependency Type']);

        const moduleData = new Map();

        if (data.requires && data.requires.length > 0) {
            for (const consumer of data.requires) {
                const key = `${consumer.module}|required`;
                if (!moduleData.has(key)) {
                    moduleData.set(key, new Set());
                }
                moduleData.get(key).add(consumer.version || 'n/a');
            }
        }

        if (data.optional && data.optional.length > 0) {
            for (const consumer of data.optional) {
                const key = `${consumer.module}|optional`;
                if (!moduleData.has(key)) {
                    moduleData.set(key, new Set());
                }
                moduleData.get(key).add(consumer.version || 'n/a');
            }
        }

        for (const [key, versions] of moduleData.entries()) {
            const [moduleName, dependencyType] = key.split('|');
            const versionList = Array.from(versions).sort().join(', ');

            csvRows.push([
                moduleName,
                versionList,
                dependencyType
            ]);
        }

        csvRows.slice(1).sort((a, b) => {
            const moduleCompare = a[0].localeCompare(b[0]);
            if (moduleCompare !== 0) return moduleCompare;
            return a[2].localeCompare(b[2]);
        });

        const csvContent = csvRows.map(row =>
            row.map(field => {
                const stringField = String(field);
                if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                    return '"' + stringField.replace(/"/g, '""') + '"';
                }
                return stringField;
            }).join(',')
        ).join('\n');

        this.downloadCSV(csvContent, `${apiId}_usage.csv`);
    },

    /**
     * Download CSV file
     * @param {string} csvContent - CSV content
     * @param {string} fileName - File name
     */
    downloadCSV(csvContent, fileName) {
        try {
            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csvContent], {
                type: 'text/csv;charset=utf-8;'
            });

            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(() => URL.revokeObjectURL(url), 100);

            console.log(`CSV exported: ${fileName}`);
        } catch (error) {
            console.error('Error exporting CSV:', error);
            alert('Error exporting CSV file. Please try again.');
        }
    },

    /**
     * Update URL with API parameter
     * @param {string} api - API name
     */
    updateUrl(api) {
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('api', api);
        history.replaceState({}, '', newUrl);
    }
};

/**
 * API Usage Count Table Manager
 */
export const ApiUsageTableManager = {
    currentData: [],
    currentSortColumn: 'count',
    currentSortAscending: false,

    /**
     * Render API usage count table
     * @param {Array} rows - Dependency rows
     */
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

        this.currentData = Array.from(usageMap.entries())
            .map(([api, users]) => ({
                api,
                count: users.size,
                provider: providesMap.get(api) || null
            }));

        this.sortData(this.currentSortColumn, this.currentSortAscending);
        this.renderTable();
    },

    /**
     * Sort data
     * @param {string} column - Column to sort by
     * @param {boolean} ascending - Sort direction
     */
    sortData(column, ascending) {
        this.currentSortColumn = column;
        this.currentSortAscending = ascending;

        this.currentData.sort((a, b) => {
            let av, bv;

            if (column === 'count') {
                av = a.count;
                bv = b.count;
                return ascending ? av - bv : bv - av;
            } else if (column === 'api') {
                av = a.api.toLowerCase();
                bv = b.api.toLowerCase();
                return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
            }

            return 0;
        });
    },

    /**
     * Render table
     */
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

        this.attachSortListeners();
        this.attachViewUsageListeners();
    },

    /**
     * Attach sort listeners
     */
    attachSortListeners() {
        const container = document.getElementById('api-usage-count');
        if (!container) return;

        container.querySelectorAll('th[data-sort-usage]').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.getAttribute('data-sort-usage');

                let ascending = true;
                if (this.currentSortColumn === column) {
                    ascending = !this.currentSortAscending;
                }

                container.querySelectorAll('th[data-sort-usage]').forEach(header => {
                    header.classList.remove('asc', 'desc');
                });

                th.classList.add(ascending ? 'asc' : 'desc');

                this.sortData(column, ascending);
                this.renderTable();
            });
        });
    },

    /**
     * Attach view usage listeners
     */
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
