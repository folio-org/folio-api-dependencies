import { describe, it, expect } from 'vitest'
import { DependencyAnalyzer } from '../../src/core/dependency-analyzer'
import type { ModuleMap, AppsMap } from '../../src/types/index'

const modules = (await import('../fixtures/dependencies.fixture.json')).default as ModuleMap
const apps = (await import('../fixtures/apps.fixture.json')).default as AppsMap

describe('DependencyAnalyzer.analyze', () => {
  it('returns empty map when apps have no dependencies', () => {
    const analyzer = new DependencyAnalyzer()
    const result = analyzer.analyze(
      { 'app-solo': { platform: 'base', modules: [], uiModules: [], dependencies: [] } },
      {}
    )
    expect(result.size).toBe(0)
  })

  it('flags app-users as removable from app-inventory (no hard requires overlap)', () => {
    const analyzer = new DependencyAnalyzer()
    const result = analyzer.analyze(apps, modules)
    expect(result.get('app-inventory')).toContain('app-users')
  })

  it('flags app-users as removable from app-notes (only optional overlap)', () => {
    const analyzer = new DependencyAnalyzer()
    const result = analyzer.analyze(apps, modules)
    expect(result.get('app-notes')).toContain('app-users')
  })

  it('app-users has no removable deps since it has no dependencies', () => {
    const analyzer = new DependencyAnalyzer()
    const result = analyzer.analyze(apps, modules)
    expect(result.has('app-users')).toBe(false)
  })
})
