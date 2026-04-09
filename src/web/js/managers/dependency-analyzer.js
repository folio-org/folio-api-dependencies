/**
 * Analyzes app dependencies to identify ones that may be unnecessary.
 *
 * A dependency is considered potentially removable when:
 * - none of the app's modules consume any interface provided by the dependency, OR
 * - the only consuming interfaces are declared as "optional" (not hard requires)
 */
export const DependencyAnalyzer = {
    /**
     * Run the analysis.
     *
     * @param {Object} appsData        - Contents of apps.json
     * @param {Object} dependenciesRaw - Contents of dependencies.json
     *                                   (moduleName → { provides, requires, optional })
     * @returns {Map<string, Set<string>>} appName → set of dependency names that appear unused
     */
    analyze(appsData, dependenciesRaw) {
        const appProvidedApis = this._buildAppProvidedApis(appsData, dependenciesRaw);
        const appHardRequiredApis = this._buildAppApiSet(appsData, dependenciesRaw, 'requires');
        const appOptionalApis = this._buildAppApiSet(appsData, dependenciesRaw, 'optional');

        const removable = new Map();

        for (const [appName, appData] of Object.entries(appsData)) {
            const unusedDeps = new Set();
            const hardRequired = appHardRequiredApis.get(appName) ?? new Set();
            const optional = appOptionalApis.get(appName) ?? new Set();

            for (const dep of (appData.dependencies ?? [])) {
                const depName = dep.name;
                const depProvided = appProvidedApis.get(depName) ?? new Set();

                // Only flag as removable when the dependency actually provides
                // some interfaces — if it provides nothing we cannot conclude anything.
                if (depProvided.size === 0) continue;

                const hasHardOverlap = [...depProvided].some(api => hardRequired.has(api));

                // Flag as removable if there's no hard-require overlap
                // (no overlap at all, or only optional overlap → dependency is not strictly needed)
                if (!hasHardOverlap) {
                    unusedDeps.add(depName);
                }
            }

            if (unusedDeps.size > 0) {
                removable.set(appName, unusedDeps);
            }
        }

        return removable;
    },

    /**
     * Resolve a UI module name (e.g. "folio_inventory") to all candidate keys
     * that may appear in dependencies.json, mirroring the logic in data-manager.js.
     *
     * @param {string} rawName
     * @returns {string[]}
     */
    _uiModuleCandidates(rawName) {
        const name = rawName.replace(/^folio_/, '').replace(/_/g, '-');
        const uiName = name.startsWith('ui-') ? name : `ui-${name}`;
        const stripesName = name.startsWith('stripes-') ? name : `stripes-${name}`;
        return [rawName, name, uiName, stripesName];
    },

    /**
     * Collect interface IDs for a given module name and dependency side.
     *
     * @param {Object}              dependenciesRaw
     * @param {string}              moduleName
     * @param {Set}                 into
     * @param {'provides'|'requires'|'optional'} side
     * @returns {boolean} whether the module was found
     * @private
     */
    _collectApis(dependenciesRaw, moduleName, into, side) {
        const modData = dependenciesRaw[moduleName];
        if (!modData) return false;

        for (const entry of (modData[side] ?? [])) into.add(entry.id);
        return true;
    },

    /**
     * Build a map of appName → Set of interface IDs provided by that app's modules
     * (backend/edge modules + UI modules).
     * @private
     */
    _buildAppProvidedApis(appsData, dependenciesRaw) {
        const map = new Map();

        for (const [appName, appData] of Object.entries(appsData)) {
            const apis = new Set();

            for (const mod of (appData.modules ?? [])) {
                this._collectApis(dependenciesRaw, mod.name, apis, 'provides');
            }

            for (const mod of (appData.uiModules ?? [])) {
                for (const candidate of this._uiModuleCandidates(mod.name)) {
                    if (this._collectApis(dependenciesRaw, candidate, apis, 'provides')) break;
                }
            }

            map.set(appName, apis);
        }

        return map;
    },

    /**
     * Build a map of appName → Set of interface IDs for a specific dependency side
     * ('requires' or 'optional') across backend/edge and UI modules.
     *
     * @param {Object} appsData
     * @param {Object} dependenciesRaw
     * @param {'requires'|'optional'} side
     * @returns {Map<string, Set<string>>}
     * @private
     */
    _buildAppApiSet(appsData, dependenciesRaw, side) {
        const map = new Map();

        for (const [appName, appData] of Object.entries(appsData)) {
            const apis = new Set();

            for (const mod of (appData.modules ?? [])) {
                this._collectApis(dependenciesRaw, mod.name, apis, side);
            }

            for (const mod of (appData.uiModules ?? [])) {
                for (const candidate of this._uiModuleCandidates(mod.name)) {
                    if (this._collectApis(dependenciesRaw, candidate, apis, side)) break;
                }
            }

            map.set(appName, apis);
        }

        return map;
    }
};
