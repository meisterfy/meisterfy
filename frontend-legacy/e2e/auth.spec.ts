import { test, expect } from '@playwright/test'

test.describe('Auth — login page', () => {
	test('renders email input, password input, and sign-in button', async ({ page }) => {
		await page.goto('/login')
		await expect(page.locator('input[type="email"]')).toBeVisible()
		await expect(page.locator('input[type="password"]')).toBeVisible()
		await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
	})

	test('wrong credentials shows error alert and stays on /login', async ({ page }) => {
		await page.goto('/login')
		await page.fill('input[type="email"]', 'bad@example.com')
		await page.fill('input[type="password"]', 'wrongpassword')
		await page.click('button[type="submit"]')
		await expect(page.getByRole('alert')).toBeVisible()
		await expect(page).toHaveURL('/login')
	})

	test('unauthenticated visit to / redirects to /login', async ({ page }) => {
		await page.goto('/')
		await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
	})

	test('successful login redirects away from /login', async ({ page }) => {
		const email = process.env.E2E_USER_EMAIL
		const password = process.env.E2E_USER_PASSWORD
		test.skip(!email || !password, 'E2E_USER_EMAIL and E2E_USER_PASSWORD not set')
		await page.goto('/login')
		await page.fill('input[type="email"]', email!)
		await page.fill('input[type="password"]', password!)
		await page.click('button[type="submit"]')
		await expect(page).not.toHaveURL('/login', { timeout: 10_000 })
	})
})
