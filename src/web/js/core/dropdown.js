import { Utils } from './utils.js';

/**
 * Reusable dropdown component class
 */
export class DropdownComponent {
    /**
     * @param {HTMLElement} input - Input element
     * @param {HTMLElement} dropdown - Dropdown container element
     * @param {Object} options - Configuration options
     */
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
