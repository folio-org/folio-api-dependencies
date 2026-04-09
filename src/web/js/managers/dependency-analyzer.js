/**
 * Analyzes app dependencies to identify ones that may be unnecessary.
 *
 * A dependency is considered potentially removable when none of the modules
 * in the dependent app (backend, edge, and UI) require (or optionally require)
 * any interface that is provided by the modules in the dependency app.
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
        const appRequiredApis = this._buildAppRequiredApis(appsData, dependenciesRaw);

        const removable = new Map();

        for (const [appName, appData] of Object.entries(appsData)) {
            const unusedDeps = new Set();
            const thisAppRequired = appRequiredApis.get(appName) ?? new Set();

            for (const dep of (appData.dependencies ?? [])) {
                const depName = dep.name;
                const depProvided = appProvidedApis.get(depName) ?? new Set();

                // Only flag as removable when the dependency actually provides
                // some interfaces — if it provides nothing we cannot conclude anything.
                if (depProvided.size === 0) continue;

                const hasOverlap = [...depProvided].some(api => thisAppRequired.has(api));
                if (!hasOverlap) {
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
     * Collect interface IDs from a module entry in dependenciesRaw, accumulating
     * either "provides" or "requires"+"optional" into the given Set.
     *
     * @param {Object}   dependenciesRaw
     * @param {string}   moduleName  - key to look up (after any name transformation)
     * @param {Set}      into        - target set
     * @param {'provides'|'requires+optional'} side
     * @returns {boolean} whether the module was found
     * @private
     */
    _collectApis(dependenciesRaw, moduleName, into, side) {
        const modData = dependenciesRaw[moduleName];
        if (!modData) return false;

        if (side === 'provides') {
            for (const p of (modData.provides ?? [])) into.add(p.id);
        } else {
            for (const r of (modData.requires ?? [])) into.add(r.id);
            for (const o of (modData.optional ?? [])) into.add(o.id);
        }
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

            // Backend and edge modules — names are used as-is
            for (const mod of (appData.modules ?? [])) {
                this._collectApis(dependenciesRaw, mod.name, apis, 'provides');
            }

            // UI modules — try all candidate name variants
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
     * Build a map of appName → Set of interface IDs required (or optionally required)
     * by that app's modules (backend/edge modules + UI modules).
     * @private
     */
    _buildAppRequiredApis(appsData, dependenciesRaw) {
        const map = new Map();

        for (const [appName, appData] of Object.entries(appsData)) {
            const apis = new Set();

            // Backend and edge modules — names are used as-is
            for (const mod of (appData.modules ?? [])) {
                this._collectApis(dependenciesRaw, mod.name, apis, 'requires+optional');
            }

            // UI modules — try all candidate name variants
            for (const mod of (appData.uiModules ?? [])) {
                for (const candidate of this._uiModuleCandidates(mod.name)) {
                    if (this._collectApis(dependenciesRaw, candidate, apis, 'requires+optional')) break;
                }
            }

            map.set(appName, apis);
        }

        return map;
    }
};
