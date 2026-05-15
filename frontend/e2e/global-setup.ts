import { chromium, type FullConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const AUTH_FILE = path.join(__dirname, '.auth/user.json')

export default async function globalSetup(config: FullConfig) {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  if (!email || !password) {
    console.log('[global-setup] Skipping: E2E_USER_EMAIL or E2E_USER_PASSWORD not set')
    return
  }

  const baseURL = config.projects[0].use.baseURL ?? 'http://localhost:5173'
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    await page.goto(`${baseURL}/login`)
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })

    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
    await page.context().storageState({ path: AUTH_FILE })
    console.log('[global-setup] Auth state saved to', AUTH_FILE)
  } finally {
    await browser.close()
  }
}
