import { test, expect } from '@playwright/test'

test('login page renders the form', async ({ page }) => {
  await page.goto('/login')

  // email input
  const emailInput = page.locator('input[type="email"]')
  await expect(emailInput).toBeVisible()

  // password input
  const passwordInput = page.locator('input[type="password"]')
  await expect(passwordInput).toBeVisible()

  // submit button
  const submitBtn = page.getByRole('button', { name: /sign in/i })
  await expect(submitBtn).toBeVisible()
})

test('submitting the login form with backend down shows a network error', async ({ page }) => {
  await page.goto('/login')

  // fill and submit — the /auth/login fetch will fail because the backend is down
  await page.locator('input[type="email"]').fill('user@example.com')
  await page.locator('input[type="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()

  // should display the network error alert and stay on /login
  // (mirrors the Svelte auth.spec "wrong credentials" flow; backend-down here
  // exercises the same error-alert + no-navigation path deterministically)
  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('Network error.')
  await expect(page).toHaveURL(/\/login/)
})

// NOTE: the Svelte auth.spec "successful login redirects away from /login" flow
// is backend-gated (needs real credentials) and is covered here at the unit level
// by src/routes/-login.test.tsx (stubbed fetch -> isAuthenticated()); a full-stack
// e2e run would assert the redirect with a live backend.
