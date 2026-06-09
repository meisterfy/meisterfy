import { test, expect } from '@playwright/test'

test('app boots', async ({ page }) => {
  await page.goto('/')
  // unauthenticated — the guard redirects to /login, proving the SPA mounted,
  // i18n/auth bootstrap completed, and routing resolved correctly
  await expect(page.getByTestId('login')).toBeVisible()
})
