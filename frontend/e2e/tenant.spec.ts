import { test, expect } from '@playwright/test'

test.describe('Posts CRUD', () => {
	test('posts list page renders for tenant', async ({ page }) => {
		// This test assumes a logged-in session with tenant access.
		// In CI, seed a test user/tenant and log in via API before tests.
		await page.goto('/test-tenant/social')
		await expect(page.locator('h2')).toContainText('Social')
	})
})

test.describe('Alerts', () => {
	test('alerts page renders', async ({ page }) => {
		await page.goto('/test-tenant/alerts')
		await expect(page.locator('h2')).toContainText('Alerts')
	})
})

test.describe('Reports', () => {
	test('reports page renders', async ({ page }) => {
		await page.goto('/test-tenant/reports')
		await expect(page.locator('h2')).toContainText('Reports')
	})
})

test.describe('Schedule', () => {
	test('schedule page renders', async ({ page }) => {
		await page.goto('/test-tenant/schedule')
		await expect(page.locator('h2')).toContainText('Schedule')
	})
})
