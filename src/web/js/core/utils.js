/**
 * Utility functions for common operations
 */
export const Utils = {
    /**
     * Get URL query parameter
     * @param {string} name - Parameter name
     * @returns {string|null} Parameter value
     */
    getQueryParam(name) {
        return new URL(window.location.href).searchParams.get(name);
    },

    /**
     * Debounce function execution
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
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

    /**
     * Highlight matching text in string
     * @param {string} text - Text to highlight in
     * @param {string} term - Term to highlight
     * @returns {string} HTML string with highlighted term
     */
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

    /**
     * Group entries by module
     * @param {Array} entries - Array of entries with module and version
     * @returns {Object} Grouped entries
     */
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

    /**
     * Extract major version number
     * @param {string} version - Version string
     * @returns {number|null} Major version or null
     */
    getMajorVersion(version) {
        if (!version || version === '?' || version === 'n/a') return null;
        const match = version.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    },

    /**
     * Check for version compatibility issues
     * @param {Array<string>} requiredVersions - Required versions
     * @param {Array<string>} providedVersions - Provided versions
     * @returns {string} Mismatch type
     */
    getVersionMismatchType(requiredVersions, providedVersions) {
        if (!providedVersions.length) return 'no-provider';

        const hasExactMatch = requiredVersions.some(v => providedVersions.includes(v));
        if (hasExactMatch) return 'compatible';

        const requiredMajors = requiredVersions
            .map(v => this.getMajorVersion(v))
            .filter(v => v !== null);
        const providedMajors = providedVersions
            .map(v => this.getMajorVersion(v))
            .filter(v => v !== null);

        if (requiredMajors.length === 0 || providedMajors.length === 0) {
            return 'version-format-issue';
        }

        const hasMajorMatch = requiredMajors.some(reqMajor =>
            providedMajors.some(provMajor => reqMajor === provMajor)
        );

        if (!hasMajorMatch) return 'major-mismatch';
        return 'minor-mismatch';
    },

    /**
     * Legacy function for backward compatibility
     * @param {Array<string>} requiredVersions - Required versions
     * @param {Array<string>} providedVersions - Provided versions
     * @returns {boolean} True if major mismatch
     */
    isMismatch(requiredVersions, providedVersions) {
        const mismatchType = this.getVersionMismatchType(requiredVersions, providedVersions);
        return mismatchType === 'major-mismatch';
    },

    /**
     * Get user-friendly mismatch message and styling
     * @param {string} mismatchType - Type of mismatch
     * @returns {Object|null} Display information
     */
    getMismatchDisplay(mismatchType) {
        switch (mismatchType) {
            case 'compatible':
                return null;
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
