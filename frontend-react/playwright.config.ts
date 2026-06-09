import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5174' },
  webServer: { command: 'bun run dev', url: 'http://localhost:5174', reuseExistingServer: true }
})
