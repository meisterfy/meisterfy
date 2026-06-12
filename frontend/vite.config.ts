import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '^/(admin|auth|setup|health|mcp|ai)': 'http://localhost:8181',
    },
  },
  // Build straight into the Go server's embed dir (//go:embed all:ui/dist).
  // emptyOutDir is required because the target lives outside this package root.
  build: {
    outDir: '../backend/cmd/server/ui/dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    expect: { requireAssertions: true },
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    // WSL2 + @base-ui interaction tests (user-event over Select/Popover/Dialog)
    // run slower than the 5s default; give them headroom to avoid flakes.
    testTimeout: 15000,
  },
})
