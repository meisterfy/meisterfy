import { test, expect } from '@playwright/test'

// Only meaningful against a blank database.
// Run with: E2E_FRESH_DB=true bunx playwright test e2e/setup.spec.ts
test.describe.configure({ mode: 'serial' })

test.describe('Setup wizard — first-time configuration', () => {
  test.beforeEach(() => {
    test.skip(!process.env.E2E_FRESH_DB, 'Requires fresh database (set E2E_FRESH_DB=true)')
  })

  test('renders the welcome form with name, email, and password fields', async ({ page }) => {
    await page.goto('/setup')
    await expect(page.getByText('Welcome to Maestro')).toBeVisible()
    await expect(page.locator('input[type="text"]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('creates first admin account and advances to the tools configuration step', async ({
    page
  }) => {
    const email = process.env.E2E_USER_EMAIL ?? 'admin@test.com'
    const password = process.env.E2E_USER_PASSWORD ?? 'SecurePassword123!'
    await page.goto('/setup')
    await page.fill('input[type="text"]', 'Admin Test')
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Configure your tools')).toBeVisible({ timeout: 10_000 })
  })

  test('/setup redirects to /login once already configured', async ({ page }) => {
    await page.goto('/setup')
    await expect(page).toHaveURL('/login', { timeout: 5_000 })
  })
})
