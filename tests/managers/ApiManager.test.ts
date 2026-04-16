import { describe, it, expect, beforeEach } from 'vitest'
import { ApiManager } from '../../src/managers/ApiManager'
import { AppStore } from '../../src/store/AppStore'
import type { DependencyRow, ApiIndex } from '../../src/types/index'

const rows: DependencyRow[] = [
  { module: 'mod-provider', type: 'provides', api: 'foo-api', version: '1.0' },
  { module: 'mod-consumer', type: 'requires', api: 'foo-api', version: '1.0' },
  { module: 'mod-optional', type: 'optional', api: 'foo-api', version: '1.0' },
]

describe('ApiManager', () => {
  let store: AppStore
  let container: HTMLElement
  let manager: ApiManager

  beforeEach(() => {
    store = new AppStore()
    const index: ApiIndex = new Map([
      ['foo-api', { provides: [rows[0]], requires: [rows[1]], optional: [rows[2]] }],
    ])
    store.setApiIndex(index)
    container = document.createElement('div')
    manager = new ApiManager(store, container)
  })

  it('renders provider, consumer, and optional sections for a known api', () => {
    manager.selectApi('foo-api')
    expect(container.innerHTML).toContain('mod-provider')
    expect(container.innerHTML).toContain('mod-consumer')
    expect(container.innerHTML).toContain('mod-optional')
  })

  it('renders not found message for unknown api', () => {
    manager.selectApi('unknown-api')
    expect(container.innerHTML).toContain('not found')
  })
})
