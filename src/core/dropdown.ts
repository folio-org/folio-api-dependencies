import { debounce, highlight } from './utils'

interface DropdownOptions {
  filterFn?: (items: string[], term: string) => string[]
  onSelect?: (item: string) => void
  highlightFn?: (text: string, term: string) => string
}

export class DropdownComponent {
  private items: string[] = []
  private filtered: string[] = []
  private activeIndex = -1
  private options: Required<DropdownOptions>

  constructor(
    private input: HTMLInputElement,
    private dropdown: HTMLElement,
    options: DropdownOptions = {}
  ) {
    this.options = {
      filterFn: options.filterFn ?? ((items, term) =>
        items.filter(i => i.toLowerCase().includes(term.toLowerCase()))
      ),
      onSelect: options.onSelect ?? (() => {}),
      highlightFn: options.highlightFn ?? highlight,
    }
  }

  init(): void {
    this.input.addEventListener('input', () => this.updateMatches())
    this.input.addEventListener('focus', () => this.updateMatches())
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e))
    document.addEventListener('click', (e) => {
      if (!this.input.contains(e.target as Node) && !this.dropdown.contains(e.target as Node)) {
        this.hideDropdown()
      }
    })
  }

  setItems(items: string[]): void {
    this.items = items
  }

  private updateMatches = debounce(() => {
    const term = this.input.value.trim()
    this.filtered = this.options.filterFn(this.items, term)
    this.renderDropdown(term)
  }, 150)

  private renderDropdown(term: string): void {
    this.dropdown.innerHTML = ''
    if (this.filtered.length === 0) { this.hideDropdown(); return }
    const fragment = document.createDocumentFragment()
    this.filtered.forEach((item, i) => {
      const div = document.createElement('div')
      div.className = 'dropdown-item'
      div.innerHTML = this.options.highlightFn(item, term)
      if (i === this.activeIndex) div.classList.add('active')
      div.addEventListener('mousedown', (e) => { e.preventDefault(); this.selectItem(item) })
      fragment.appendChild(div)
    })
    this.dropdown.appendChild(fragment)
    this.showDropdown()
  }

  private selectItem(item: string): void {
    this.input.value = item
    this.hideDropdown()
    this.options.onSelect(item)
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      this.activeIndex = Math.min(this.activeIndex + 1, this.filtered.length - 1)
      this.renderDropdown(this.input.value)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      this.activeIndex = Math.max(this.activeIndex - 1, -1)
      this.renderDropdown(this.input.value)
    } else if (e.key === 'Enter' && this.activeIndex >= 0) {
      e.preventDefault()
      this.selectItem(this.filtered[this.activeIndex])
    } else if (e.key === 'Escape') {
      this.hideDropdown()
    }
  }

  private showDropdown(): void { this.dropdown.style.display = 'block' }
  private hideDropdown(): void { this.dropdown.style.display = 'none'; this.activeIndex = -1 }
}
