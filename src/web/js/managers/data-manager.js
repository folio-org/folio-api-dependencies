/**
 * Data loading and processing manager
 */
export const DataManager = {
    moduleToAppsMap: new Map(),

    /**
     * Load dependencies from JSON file
     * @returns {Promise<Array>} Processed dependency rows
     */
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

    /**
     * Load apps from JSON file
     * @returns {Promise<Object>} Apps data
     */
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

    /**
     * Build mapping from modules to apps
     * @param {Object} appsData - Apps data object
     */
    buildModuleToAppsMap(appsData) {
        this.moduleToAppsMap.clear();

        for (const [appName, appData] of Object.entries(appsData)) {
            // Process backend modules
            if (appData.modules) {
                appData.modules.forEach(module => {
                    if (!this.moduleToAppsMap.has(module.name)) {
                        this.moduleToAppsMap.set(module.name, []);
                    }
                    this.moduleToAppsMap.get(module.name).push(appName);
                });
            }

            // Process UI modules
            if (appData.uiModules) {
                appData.uiModules.forEach(uiModule => {
                    const moduleName = uiModule.name
                        .replace(/^folio_/, '')
                        .replace(/_/g, '-');

                    const uiModuleName = moduleName.startsWith('ui-') ? moduleName : `ui-${moduleName}`;
                    const stripesModuleName = moduleName.startsWith('stripes-') ? moduleName : `stripes-${moduleName}`;

                    [uiModule.name, moduleName, uiModuleName, stripesModuleName].forEach(name => {
                        if (!this.moduleToAppsMap.has(name)) {
                            this.moduleToAppsMap.set(name, []);
                        }
                        if (!this.moduleToAppsMap.get(name).includes(appName)) {
                            this.moduleToAppsMap.get(name).push(appName);
                        }
                    });
                });
            }
        }
    },

    /**
     * Get apps for a given module
     * @param {string} moduleName - Module name
     * @returns {Array<string>} Array of app names
     */
    getAppsForModule(moduleName) {
        return this.moduleToAppsMap.get(moduleName) || [];
    },

    /**
     * Process raw dependency data into rows
     * @param {Object} data - Raw dependency data
     * @returns {Array} Processed rows
     */
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

    /**
     * Build API index from rows
     * @param {Array} rows - Dependency rows
     * @returns {Map} API index
     */
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
