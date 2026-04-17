import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        'src/fetchers/**',
        'src/web/**',
        'src/app.ts',
        'src/managers/GraphManager.ts',
        'src/managers/ModuleConsumersGraphManager.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
      },
    },
  },
})
