# Refactor Design: folio-api-dependencies

**Date:** 2026-04-16  
**Scope:** Full refactor — TypeScript migration, Vite build, injectable class architecture, Vitest test suite, duplication removal, CI gate

---

## 1. Architecture Overview

### Build Toolchain

| Tool | Role |
|---|---|
| `vite` | Dev server with HMR, production bundler |
| `vitest` | Unit and integration test runner (shares Vite config) |
| `tsc --noEmit` | Type-checking only (no emit — Vite handles transpilation) |
| `tsx` | Run TypeScript fetcher scripts directly in Node.js |

### Project Structure (after refactor)

```
folio-api-dependencies/
├── src/
│   ├── fetchers/
│   │   ├── fetch-descriptors.ts
│   │   ├── fetch-apps.ts
│   │   └── github-client.ts        # Shared GitHub API client
│   ├── types/
│   │   └── index.ts                # All shared TS interfaces/types
│   ├── core/
│   │   ├── utils.ts                # Pure utilities (debounce, CSV, version parsing)
│   │   ├── dependency-analyzer.ts  # Pure analysis logic
│   │   └── dropdown.ts             # DropdownComponent class
│   ├── managers/
│   │   ├── DataManager.ts
│   │   ├── TableManager.ts
│   │   ├── ApiManager.ts
│   │   ├── AppsManager.ts
│   │   ├── GraphManager.ts
│   │   └── ModuleConsumersGraphManager.ts
│   ├── store/
│   │   └── AppStore.ts             # Replaces global AppState singleton
│   └── app.ts                      # Bootstrap/wiring only
├── public/
│   └── data/                       # Generated JSON (served as static assets)
│       ├── dependencies.json
│       └── apps.json
├── index.html                      # Vite entry point (moved to root)
├── tests/
│   ├── fixtures/
│   │   ├── dependencies.fixture.json
│   │   └── apps.fixture.json
│   ├── core/
│   │   ├── utils.test.ts
│   │   └── dependency-analyzer.test.ts
│   ├── managers/
│   │   ├── DataManager.test.ts
│   │   ├── TableManager.test.ts
│   │   ├── ApiManager.test.ts
│   │   └── AppsManager.test.ts
│   └── integration/
│       └── data-flow.test.ts
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

### Key Architectural Shift: Singletons → Injectable Classes

Every manager refactored from singleton object to class with constructor injection:

```ts
// Before (singleton, untestable)
const DataManager = {
  async loadDependencies() {
    const res = await fetch('/dependencies.json')
    AppState.data = await res.json()
  }
}

// After (class, testable)
class DataManager {
  constructor(private fetcher: Fetcher, private store: AppStore) {}

  async load(): Promise<void> {
    const [modules, apps] = await Promise.all([
      this.fetcher.fetchJson<ModuleMap>('/data/dependencies.json'),
      this.fetcher.fetchJson<AppsMap>('/data/apps.json'),
    ])
    this.store.setModules(modules)
    this.store.setApps(apps)
  }
}
```

`app.ts` is the single composition root — it instantiates `HttpFetcher`, `AppStore`, and all managers.

---

## 2. Type System

### Shared Types (`src/types/index.ts`)

```ts
interface ApiDescriptor {
  id: string
  version: string
}

interface ModuleDescriptor {
  provides: ApiDescriptor[]
  requires: ApiDescriptor[]
  optional: ApiDescriptor[]
}

type ModuleMap = Record<string, ModuleDescriptor>

interface AppDescriptor {
  platform: string
  modules: { name: string; version: string }[]
  uiModules: { name: string; version: string }[]
  dependencies: { name: string; version: string }[]
}

type AppsMap = Record<string, AppDescriptor>

interface DependencyRow {
  module: string
  type: 'provides' | 'requires' | 'optional'
  api: string
  version: string
}

type RemovableDepsMap = Map<string, Set<string>>
```

### Fetcher Abstraction

```ts
interface Fetcher {
  fetchJson<T>(url: string): Promise<T>
}

class HttpFetcher implements Fetcher {
  async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
    return res.json() as Promise<T>
  }
}

class MockFetcher implements Fetcher {
  constructor(private fixtures: Record<string, unknown>) {}
  async fetchJson<T>(url: string): Promise<T> {
    if (!(url in this.fixtures)) throw new Error(`No fixture for ${url}`)
    return this.fixtures[url] as T
  }
}
```

### AppStore (`src/store/AppStore.ts`)

Replaces global `AppState`. Instantiated once in `app.ts`, injected into all managers:

```ts
interface AppStore {
  getModules(): ModuleMap
  setModules(data: ModuleMap): void
  getApps(): AppsMap
  setApps(data: AppsMap): void
  getRows(): DependencyRow[]
  setRows(rows: DependencyRow[]): void
  getRemovableDeps(): RemovableDepsMap
  setRemovableDeps(map: RemovableDepsMap): void
}
```

---

## 3. Testing Strategy

### Test Layers

| Layer | Scope | Environment |
|---|---|---|
| Unit — core | `utils.ts`, `dependency-analyzer.ts`, `AppStore` | Node (no DOM) |
| Unit — managers | Each manager class with mocks | jsdom |
| Integration | fixture JSON → DataManager → DependencyAnalyzer → assert output | Node |
| Smoke | Existing `test-modules.html` (keep as-is) | Browser (manual) |

### Coverage Targets

| Layer | Target |
|---|---|
| `src/core/` | 90%+ |
| `src/managers/` | 70%+ |
| `src/store/` | 90%+ |

### Test Fixtures

- `tests/fixtures/dependencies.fixture.json` — ~5 modules with known API relationships
- `tests/fixtures/apps.fixture.json` — ~3 apps where expected removable deps are manually verifiable

Fixtures are sized so expected `DependencyAnalyzer` output is deterministic and human-readable — tests assert exact known outputs.

### Vitest Config

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      thresholds: { lines: 70, functions: 70 },
    },
  },
})
```

---

## 4. Duplication Removal

### Double-fetch of `dependencies.json`

Current `DataManager` fetches the same file twice. Fixed by single `load()` with `Promise.all`.

### Duplicated `downloadCSV`

Copy-pasted in `TableManager` and `ApiManager`. Extracted to `src/core/utils.ts`:

```ts
export function downloadCSV(filename: string, rows: string[][]): void {
  const content = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}
```

### Duplicated GitHub API logic in fetchers

Both fetcher scripts duplicate pagination and rate-limit handling. Extracted to `src/fetchers/github-client.ts`:

```ts
class GitHubClient {
  constructor(private token: string) {}
  async listOrgRepos(org: string): Promise<Repo[]>
  async getFileContent(repo: string, path: string): Promise<string>
}
```

---

## 5. CI/CD Integration

### Updated `package.json` Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "fetch:descriptors": "tsx src/fetchers/fetch-descriptors.ts",
    "fetch:apps": "tsx src/fetchers/fetch-apps.ts",
    "fetch:all": "npm run fetch:descriptors && npm run fetch:apps"
  }
}
```

### GitHub Actions — New `ci.yml`

Runs on push and PR to `master`. Enforces: types pass → tests pass → build succeeds.

```yaml
name: CI
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test:coverage
      - run: npm run build
```

Existing `fetch-data.yml` updated to replace `node` calls with `tsx`.

---

## Summary

| Area | Change |
|---|---|
| Build | Vite + TypeScript (`esbuild` transpile, `tsc` type-check) |
| Architecture | Singletons → injectable classes with `Fetcher` + `AppStore` |
| Types | Shared `src/types/index.ts`, `Fetcher` interface, `AppStore` interface |
| Tests | Vitest + jsdom, fixtures, 70%+ coverage gate |
| Duplication | `downloadCSV` extracted, double-fetch eliminated, `GitHubClient` shared |
| CI | Type-check + test + build gate on every PR via `ci.yml` |
