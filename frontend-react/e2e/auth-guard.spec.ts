import { test, expect } from '@playwright/test'

test('unauthenticated user is redirected to login', async ({ page }) => {
  await page.goto('/')
  // mirrors the Svelte auth.spec "unauthenticated visit to / redirects to /login"
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  await expect(page.locator('input[type="email"]')).toBeVisible()
})
