import { describe, it, expect, beforeEach } from 'vitest'
import { TableManager } from '../../src/managers/TableManager'
import { AppStore } from '../../src/store/AppStore'
import type { DependencyRow } from '../../src/types/index'

const rows: DependencyRow[] = [
  { module: 'mod-foo', type: 'provides', api: 'foo-api', version: '1.0' },
  { module: 'mod-foo', type: 'requires', api: 'bar-api', version: '2.0' },
  { module: 'mod-bar', type: 'provides', api: 'bar-api', version: '2.0' },
]

describe('TableManager', () => {
  let store: AppStore
  let tbody: HTMLTableSectionElement
  let manager: TableManager

  beforeEach(() => {
    store = new AppStore()
    store.setRows(rows)
    tbody = document.createElement('tbody')
    manager = new TableManager(store, tbody, () => [])
  })

  it('renders one row per dependency entry', () => {
    manager.renderTable(rows)
    expect(tbody.querySelectorAll('tr').length).toBe(rows.length)
  })

  it('filters rows by search term matching module name', () => {
    manager.renderTable(rows)
    manager.filterTable('mod-foo')
    const visible = Array.from(tbody.querySelectorAll('tr')).filter(
      tr => (tr as HTMLElement).style.display !== 'none'
    )
    expect(visible.length).toBe(2)
  })

  it('buildGroupedRows groups entries by module+type+api key', () => {
    const grouped = manager.buildGroupedRows(rows)
    expect(grouped.size).toBe(3)
  })
})
