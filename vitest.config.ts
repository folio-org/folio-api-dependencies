import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/fetchers/**'],
      thresholds: {
        lines: 70,
        functions: 70,
      },
    },
  },
})
