import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/server/__tests__/setup.ts'],
    // Cada arquivo de teste cria um Postgres efêmero (PGlite/WASM). Rodar os
    // arquivos em série evita o pico de memória de várias instâncias paralelas.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/server/**/*.ts'],
      exclude: ['src/server/__tests__/**', 'src/server/db/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
