import { AppState } from '../core/state.js';
import { DataManager } from './data-manager.js';

/**
 * Table rendering and management
 */
export const TableManager = {
    /**
     * Render table with given rows
     * @param {Array} rows - Rows to render
     */
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
            const apps = DataManager.getAppsForModule(module);
            const appsText = apps.length > 0 ? apps.join(', ') : '-';

            groupedDisplayRows.push({ module, type, api, version: versionText, apps: appsText });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${module}</td>
                <td class="type-${type}">${type}</td>
                <td>${api}</td>
                <td>${versionText}</td>
                <td title="${appsText}">${appsText}</td>
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

        this.attachViewUsageListeners();
    },

    /**
     * Group rows by module, type, and API
     * @param {Array} rows - Rows to group
     * @returns {Map} Grouped rows
     */
    groupRows(rows) {
        const grouped = new Map();
        for (const row of rows) {
            const key = `${row.module}|${row.type}|${row.api}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(row.version || '?');
        }
        return grouped;
    },

    /**
     * Sort table by column
     * @param {string} column - Column to sort by
     * @param {boolean} ascending - Sort direction
     */
    sortTableBy(column, ascending = true) {
        const rows = [...AppState.currentGroupedRows];
        rows.sort((a, b) => {
            const av = a[column]?.toLowerCase?.() ?? '';
            const bv = b[column]?.toLowerCase?.() ?? '';
            return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
        });

        this.renderSortedRows(rows);
    },

    /**
     * Render sorted rows
     * @param {Array} rows - Sorted rows
     */
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
                <td title="${row.apps}">${row.apps}</td>
                <td>
                    <button class="view-usage-btn" data-api="${row.api}" title="View API usage details">
                        View Usage
                    </button>
                </td>
            `;
            fragment.appendChild(tr);
        }

        tbody.appendChild(fragment);
        this.attachViewUsageListeners();
    },

    /**
     * Attach event listeners to view usage buttons
     */
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

    /**
     * Redirect to API usage view
     * @param {string} api - API name
     */
    redirectToApiUsage(api) {
        const apiUsageTabButton = document.querySelector('.tab-button[data-tab="api"]');
        if (apiUsageTabButton) {
            apiUsageTabButton.click();

            setTimeout(() => {
                const input = AppState.elements.apiSelect;
                if (input) {
                    input.value = api;
                    input.dispatchEvent(new Event('input'));
                    // Note: ApiManager.selectApi will be called via event
                }
            }, 50);
        }
    },

    /**
     * Export table data to CSV
     */
    exportTableToCSV() {
        if (!AppState.currentGroupedRows || AppState.currentGroupedRows.length === 0) {
            console.warn('No data available for export');
            alert('No data to export');
            return;
        }

        const csvRows = [];
        csvRows.push(['Module', 'Type', 'API', 'Version(s)', 'Part of Apps']);

        for (const row of AppState.currentGroupedRows) {
            csvRows.push([
                row.module,
                row.type,
                row.api,
                row.version,
                row.apps
            ]);
        }

        const csvContent = csvRows.map(row =>
            row.map(field => {
                const stringField = String(field);
                if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                    return '"' + stringField.replace(/"/g, '""') + '"';
                }
                return stringField;
            }).join(',')
        ).join('\n');

        this.downloadCSV(csvContent, 'folio-dependencies.csv');
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
    }
};
