import { test, expect } from '@playwright/test'

const SESSION_KEY = 'meisterfy_session'
const TENANT = 'test-tenant-id'

const SESSION_FIXTURE = {
  user: {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    tenant_id: TENANT,
    permissions: [],
    locale: 'en',
    system_role: 'user',
  },
  token: 'test-token',
  expiresAt: Date.now() + 60 * 60 * 1000,
}

async function seedList(page: import('@playwright/test').Page) {
  await page.addInitScript(
    (args: { key: string; value: string }) => {
      sessionStorage.setItem(args.key, args.value)
    },
    { key: SESSION_KEY, value: JSON.stringify(SESSION_FIXTURE) },
  )

  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'test-token',
        user: SESSION_FIXTURE.user,
        tenant_id: SESSION_FIXTURE.user.tenant_id,
        permissions: [],
      }),
    }),
  )

  // Live campaigns — scope BEFORE the broader campaigns glob; both use the real
  // `/admin/` path so they never hit Vite's /src/lib/api/campaigns.ts module.
  await page.route('**/admin/tenants/*/campaigns/live*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'live-1',
            name: 'Live Promo',
            status: 'ENABLED',
            impressions: '1200',
            clicks: '34',
            cost: 'R$ 50',
          },
        ],
      }),
    }),
  )
  await page.route('**/admin/tenants/*/campaigns*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: '2026-01-01_promo',
            tenant_id: TENANT,
            slug: '2026-01-01_promo',
            data: { result: { id: '2026-01-01_promo', status: 'draft', objective: 'Lead gen' } },
          },
        ],
      }),
    }),
  )

  // $tenant layout: tenant + tenants list.
  await page.route('**/admin/tenants/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: TENANT, name: 'Test Tenant' }),
    }),
  )
  await page.route('**/admin/tenants', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  )
}

test('google ads list renders merged live + local campaigns', async ({ page }) => {
  await seedList(page)

  await page.goto(`/${TENANT}/ads/google`)

  await expect(page.getByRole('heading', { name: 'Campaign Manager' })).toBeVisible()
  await expect(page.getByText('Live Promo')).toBeVisible()
  await expect(page.getByText('2026-01-01_promo').first()).toBeVisible()
})

test('opening the import modal shows the JSON instructions', async ({ page }) => {
  await seedList(page)

  await page.goto(`/${TENANT}/ads/google`)
  await page.getByRole('button', { name: 'New Campaign' }).click()

  await expect(page.getByRole('heading', { name: 'Import Google Ads Campaign' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Import Campaign' })).toBeVisible()
})
