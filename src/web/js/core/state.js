/**
 * Global application state management
 * Centralizes all app state and DOM element caching
 */
export const AppState = {
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

    /**
     * Initialize and cache DOM elements
     */
    init() {
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
