import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@quickfiller/domain': resolve(__dirname, 'packages/domain/src/index.ts'),
      '@quickfiller/application': resolve(
        __dirname,
        'packages/application/src/index.ts',
      ),
      '@quickfiller/infrastructure': resolve(
        __dirname,
        'packages/infrastructure/src/index.ts',
      ),
    },
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/domain/src/**', 'packages/application/src/**'],
      thresholds: {
        'packages/domain/src/**': { branches: 90, functions: 90, lines: 90 },
        'packages/application/src/**': { branches: 80, functions: 80, lines: 80 },
      },
    },
    testTimeout: 10_000,
    hookTimeout: 30_000,
  },
})
