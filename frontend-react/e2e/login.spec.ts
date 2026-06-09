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

  // should display the network error alert
  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('Network error.')
})
