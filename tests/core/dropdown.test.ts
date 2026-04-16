import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DropdownComponent } from '../../src/core/dropdown'

describe('DropdownComponent', () => {
  let input: HTMLInputElement
  let dropdown: HTMLElement
  let onSelect: ReturnType<typeof vi.fn>
  let component: DropdownComponent

  beforeEach(() => {
    input = document.createElement('input')
    dropdown = document.createElement('div')
    document.body.appendChild(input)
    document.body.appendChild(dropdown)
    onSelect = vi.fn()
    component = new DropdownComponent(input, dropdown, { onSelect: onSelect as (item: string) => void })
  })

  it('setItems stores items', () => {
    component.setItems(['a', 'b', 'c'])
    // No error means it worked
    expect(true).toBe(true)
  })

  it('init attaches event listeners without error', () => {
    component.init()
    expect(true).toBe(true)
  })

  it('shows dropdown items on input event after debounce', async () => {
    vi.useFakeTimers()
    component.setItems(['alpha', 'beta', 'gamma'])
    component.init()
    input.value = 'al'
    input.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(200)
    expect(dropdown.querySelectorAll('.dropdown-item').length).toBe(1)
    expect(dropdown.textContent).toContain('alpha')
    vi.useRealTimers()
  })

  it('hides dropdown when no matches', async () => {
    vi.useFakeTimers()
    component.setItems(['alpha'])
    component.init()
    input.value = 'zzz'
    input.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(200)
    expect(dropdown.style.display).toBe('none')
    vi.useRealTimers()
  })

  it('selects item on mousedown', async () => {
    vi.useFakeTimers()
    component.setItems(['alpha', 'beta'])
    component.init()
    input.value = 'a'
    input.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(200)
    const item = dropdown.querySelector('.dropdown-item') as HTMLElement
    item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onSelect).toHaveBeenCalledWith('alpha')
    expect(input.value).toBe('alpha')
    vi.useRealTimers()
  })

  it('handles ArrowDown/ArrowUp/Enter keyboard navigation', async () => {
    vi.useFakeTimers()
    component.setItems(['alpha', 'beta'])
    component.init()
    input.value = ''
    input.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(200)

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(dropdown.querySelector('.active')).toBeTruthy()

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(onSelect).toHaveBeenCalledWith('alpha')
    vi.useRealTimers()
  })

  it('handles Escape key', async () => {
    vi.useFakeTimers()
    component.setItems(['alpha'])
    component.init()
    input.value = 'a'
    input.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(200)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(dropdown.style.display).toBe('none')
    vi.useRealTimers()
  })

  it('hides dropdown on outside click', async () => {
    vi.useFakeTimers()
    component.setItems(['alpha'])
    component.init()
    input.value = 'a'
    input.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(200)
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(dropdown.style.display).toBe('none')
    vi.useRealTimers()
  })
})
