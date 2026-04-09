import { AppState } from '../core/state.js';
import { Utils } from '../core/utils.js';

/**
 * Apps management and rendering
 */
export const AppsManager = {
    allApps: [],
    /** Map<appName, Set<depName>> produced by DependencyAnalyzer */
    removableDeps: new Map(),

    /**
     * Initialize apps manager
     * @param {Object} appsData    - Apps data
     * @param {Map}    removableDeps - Analysis result: which dependencies are unused
     */
    init(appsData, removableDeps = new Map()) {
        this.removableDeps = removableDeps;
        this.allApps = Object.entries(appsData).map(([repoName, data]) => ({
            repoName,
            ...data
        }));

        this.renderApps(this.allApps);
        this.initSearch();
    },

    /**
     * Render apps list
     * @param {Array} apps - Apps to render
     */
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

    /**
     * Render single app card
     * @param {Object} app - App data
     * @returns {string} HTML string
     */
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

    /**
     * Render app dependencies
     * @param {Object} app - App data
     * @returns {string} HTML string
     */
    renderDependencies(app) {
        if (!app.dependencies || app.dependencies.length === 0) {
            return '<div class="app-section"><h4>📦 Dependencies</h4><div class="empty-section">No dependencies</div></div>';
        }

        const unusedForThisApp = this.removableDeps.get(app.repoName) ?? new Set();

        const items = app.dependencies.map(dep => {
            const isRemovable = unusedForThisApp.has(dep.name);
            const removableBadge = isRemovable
                ? `<span class="dep-removable-badge" title="No interface overlap detected between this app's modules and the dependency's provided APIs. This dependency may be removable.">⚠️ may be removable</span>`
                : '';
            const liClass = isRemovable ? ' class="dep-removable"' : '';
            return `
                <li${liClass}>
                    <code>${dep.name}</code>
                    <span class="version">${dep.version}</span>
                    ${removableBadge}
                </li>
            `;
        }).join('');

        const removableCount = unusedForThisApp.size;
        const warningBadge = removableCount > 0
            ? `<span class="section-removable-badge" title="${removableCount} dependenc${removableCount === 1 ? 'y' : 'ies'} with no detected interface usage">${removableCount} possibly unused</span>`
            : '';

        return `
            <div class="app-section">
                <h4>📦 Dependencies (${app.dependencies.length}) ${warningBadge}</h4>
                <ul class="app-list dependencies">${items}</ul>
            </div>
        `;
    },

    /**
     * Render backend modules
     * @param {Object} app - App data
     * @returns {string} HTML string
     */
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

    /**
     * Render UI modules
     * @param {Object} app - App data
     * @returns {string} HTML string
     */
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

    /**
     * Initialize search functionality
     */
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
