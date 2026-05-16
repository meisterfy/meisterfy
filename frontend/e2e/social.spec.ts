import { test, expect } from '@playwright/test'
import { AUTH_FILE } from './global-setup.js'
import fs from 'fs'

function hasValidAuth(): boolean {
	try {
		const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
		return Array.isArray(state?.cookies) && state.cookies.length > 0
	} catch {
		return false
	}
}

test.use({ storageState: AUTH_FILE })

test.describe('Social — post creation golden path', () => {
	let tenantURL: string

	test.beforeAll(async ({ browser }) => {
		if (!hasValidAuth()) {
			test.skip()
			return
		}
		const page = await browser.newPage()
		await page.goto('/')
		await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 })

		if (process.env.E2E_TENANT_SLUG) {
			tenantURL = `/${process.env.E2E_TENANT_SLUG}/social`
		} else {
			// Pick the first tenant from the dashboard
			const firstTenantLink = page.locator('a[href*="/social"]').first()
			await expect(firstTenantLink).toBeVisible({ timeout: 10_000 })
			tenantURL = new URL((await firstTenantLink.getAttribute('href')) ?? '', 'http://x').pathname
		}

		await page.close()
	})

	test('social planner renders the calendar with month heading', async ({ page }) => {
		await page.goto(tenantURL)
		await expect(page.getByRole('heading', { level: 2 })).toBeVisible()
	})

	test('clicking + on a calendar cell opens the new-post drawer', async ({ page }) => {
		await page.goto(tenantURL)
		await page.getByRole('button', { name: 'New post' }).first().click()
		await expect(page.locator('#new-title')).toBeVisible()
		await expect(page.locator('#new-content')).toBeVisible()
	})

	test('filling the form and clicking Add to Planner adds the post to the calendar', async ({
		page
	}) => {
		await page.goto(tenantURL)
		await page.getByRole('button', { name: 'New post' }).first().click()
		await page.fill('#new-title', 'E2E Test Post')
		await page.fill('#new-content', 'Automated end-to-end test post — safe to delete.')
		await page.getByRole('button', { name: 'Add to Planner' }).click()
		await expect(page.getByText('E2E Test Post')).toBeVisible({ timeout: 10_000 })
	})
})
