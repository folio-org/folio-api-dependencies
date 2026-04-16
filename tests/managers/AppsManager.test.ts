import { describe, it, expect, beforeEach } from 'vitest'
import { AppsManager } from '../../src/managers/AppsManager'
import type { AppsMap, RemovableDepsMap } from '../../src/types/index'

const apps: AppsMap = {
  'app-foo': {
    platform: 'base',
    modules: [{ name: 'mod-foo', version: '1.0.0' }],
    uiModules: [],
    dependencies: [{ name: 'app-bar', version: '1.0.0' }],
  },
  'app-bar': {
    platform: 'complete',
    modules: [],
    uiModules: [],
    dependencies: [],
  },
}

describe('AppsManager', () => {
  let container: HTMLElement
  let manager: AppsManager

  beforeEach(() => {
    container = document.createElement('div')
    manager = new AppsManager(container)
  })

  it('renders a card for each app', () => {
    manager.init(apps, new Map())
    expect(container.querySelectorAll('.app-card').length).toBe(2)
  })

  it('marks removable dependencies with a css class', () => {
    const removable: RemovableDepsMap = new Map([['app-foo', new Set(['app-bar'])]])
    manager.init(apps, removable)
    expect(container.innerHTML).toContain('removable')
  })

  it('filters cards by search term', () => {
    manager.init(apps, new Map())
    manager.filter('app-foo')
    const visible = Array.from(container.querySelectorAll<HTMLElement>('.app-card')).filter(
      el => el.style.display !== 'none'
    )
    expect(visible.length).toBe(1)
  })
})
