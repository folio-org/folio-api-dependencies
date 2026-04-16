import { describe, it, expect, vi } from 'vitest'
import {
  getMajorVersion,
  getVersionMismatchType,
  isMismatch,
  getMismatchDisplay,
  groupByModule,
  highlight,
  debounce,
  downloadCSV,
} from '../../src/core/utils'

describe('getMajorVersion', () => {
  it('returns integer part of version string', () => {
    expect(getMajorVersion('12.0')).toBe(12)
  })

  it('returns null for non-numeric string', () => {
    expect(getMajorVersion('abc')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getMajorVersion('')).toBeNull()
  })
})

describe('getVersionMismatchType', () => {
  it('returns compatible when required version is within provided range', () => {
    expect(getVersionMismatchType(['7.0'], ['7.2'])).toBe('compatible')
  })

  it('returns major-mismatch when major versions differ', () => {
    expect(getVersionMismatchType(['8.0'], ['7.2'])).toBe('major-mismatch')
  })

  it('returns no-provider when provided is empty', () => {
    expect(getVersionMismatchType(['7.0'], [])).toBe('no-provider')
  })

  it('returns minor-mismatch when minor version of provided is less than required', () => {
    expect(getVersionMismatchType(['7.5'], ['7.2'])).toBe('minor-mismatch')
  })
})

describe('isMismatch', () => {
  it('returns true only for major-mismatch', () => {
    expect(isMismatch(['8.0'], ['7.2'])).toBe(true)
  })

  it('returns false for compatible versions', () => {
    expect(isMismatch(['7.0'], ['7.2'])).toBe(false)
  })
})

describe('getMismatchDisplay', () => {
  it('returns null for compatible', () => {
    expect(getMismatchDisplay('compatible')).toBeNull()
  })

  it('returns object with severity for major-mismatch', () => {
    const result = getMismatchDisplay('major-mismatch')
    expect(result).not.toBeNull()
    expect(result?.severity).toBeDefined()
  })
})

describe('groupByModule', () => {
  it('groups entries by module key and collects versions', () => {
    const entries = [
      { module: 'a', version: '1.0' },
      { module: 'a', version: '2.0' },
      { module: 'b', version: '1.0' },
    ]
    const result = groupByModule(entries)
    expect(result['a']).toEqual(['1.0', '2.0'])
    expect(result['b']).toEqual(['1.0'])
  })

  it('returns keys sorted alphabetically', () => {
    const entries = [
      { module: 'z', version: '1.0' },
      { module: 'a', version: '1.0' },
    ]
    const result = groupByModule(entries)
    expect(Object.keys(result)).toEqual(['a', 'z'])
  })
})

describe('highlight', () => {
  it('wraps matching text in <strong>', () => {
    expect(highlight('hello world', 'world')).toContain('<strong>')
  })

  it('returns original text when no match', () => {
    expect(highlight('hello', 'xyz')).toBe('hello')
  })
})

describe('debounce', () => {
  it('delays function execution', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('executes only once if called multiple times within wait', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced()
    debounced()
    debounced()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})

describe('downloadCSV', () => {
  it('creates an anchor element and triggers click', () => {
    const clickSpy = vi.fn()
    const anchor = document.createElement('a')
    vi.spyOn(anchor, 'click').mockImplementation(clickSpy)
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    downloadCSV('test.csv', [['col1', 'col2'], ['val1', 'val2']])
    expect(anchor.download).toBe('test.csv')
    expect(clickSpy).toHaveBeenCalled()
  })
})
