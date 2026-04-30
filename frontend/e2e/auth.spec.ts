import { test, expect } from '@playwright/test'

test.describe('Auth flows', () => {
	test('login page renders', async ({ page }) => {
		await page.goto('/login')
		await expect(page.locator('h1')).toHaveText('Sign in')
		await expect(page.locator('input[type="email"]')).toBeVisible()
		await expect(page.locator('input[type="password"]')).toBeVisible()
	})

	test('login with invalid credentials shows error', async ({ page }) => {
		await page.goto('/login')
		await page.fill('input[type="email"]', 'bad@example.com')
		await page.fill('input[type="password"]', 'wrong')
		await page.click('button[type="submit"]')
		await expect(page.locator('text=Login failed')).toBeVisible()
	})
})

test.describe('Tenant onboarding', () => {
	test('create first client page renders', async ({ page }) => {
		await page.goto('/tenants/new')
		await expect(page.locator('h1')).toContainText('Create your first client')
	})
})

test.describe('Navigation', () => {
	test('root redirects to login when unauthenticated', async ({ page }) => {
		await page.goto('/')
		await expect(page).toHaveURL(/.*login/)
	})
})
