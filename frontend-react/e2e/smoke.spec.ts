import { test, expect } from '@playwright/test'

test('app boots and renders home', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('home')).toBeVisible()
})
