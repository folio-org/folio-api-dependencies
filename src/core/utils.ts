export function getMajorVersion(version: string): number | null {
  const match = version.match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

export function getVersionMismatchType(
  requiredVersions: string[],
  providedVersions: string[]
): string {
  if (providedVersions.length === 0) return 'no-provider'

  for (const required of requiredVersions) {
    const reqMajor = getMajorVersion(required)
    const reqMinor = parseFloat(required.split('.')[1] ?? '0')
    if (reqMajor === null) return 'version-format-issue'

    let hasCompatible = false
    for (const provided of providedVersions) {
      const provMajor = getMajorVersion(provided)
      const provMinor = parseFloat(provided.split('.')[1] ?? '0')
      if (provMajor === null) return 'version-format-issue'
      if (provMajor === reqMajor) {
        if (provMinor >= reqMinor) {
          hasCompatible = true
        } else {
          return 'minor-mismatch'
        }
      } else {
        return 'major-mismatch'
      }
    }
    if (!hasCompatible) return 'major-mismatch'
  }

  return 'compatible'
}

export function isMismatch(requiredVersions: string[], providedVersions: string[]): boolean {
  return getVersionMismatchType(requiredVersions, providedVersions) === 'major-mismatch'
}

export interface MismatchDisplay {
  icon: string
  text: string
  color: string
  severity: string
}

export function getMismatchDisplay(mismatchType: string): MismatchDisplay | null {
  switch (mismatchType) {
    case 'compatible': return null
    case 'major-mismatch': return { icon: '🔴', text: 'Major version mismatch', color: '#e74c3c', severity: 'high' }
    case 'minor-mismatch': return { icon: '🟡', text: 'Minor version mismatch', color: '#f39c12', severity: 'medium' }
    case 'no-provider': return { icon: '⚪', text: 'No provider found', color: '#95a5a6', severity: 'low' }
    case 'version-format-issue': return { icon: '❓', text: 'Version format issue', color: '#9b59b6', severity: 'low' }
    default: return null
  }
}

export function groupByModule(entries: { module: string; version: string }[]): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const entry of entries) {
    if (!result[entry.module]) result[entry.module] = []
    result[entry.module].push(entry.version)
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)))
}

export function highlight(text: string, term: string): string {
  if (!term) return text
  const idx = text.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return text
  return (
    text.slice(0, idx) +
    `<strong>${text.slice(idx, idx + term.length)}</strong>` +
    text.slice(idx + term.length)
  )
}

export function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => func(...args), wait)
  }) as T
}

export function downloadCSV(filename: string, rows: string[][]): void {
  const BOM = '\uFEFF'
  const content = BOM + rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

export function getQueryParam(name: string): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get(name)
}
