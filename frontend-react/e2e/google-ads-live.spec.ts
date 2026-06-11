import { test, expect } from '@playwright/test'

const SESSION_KEY = 'meisterfy_session'
const TENANT = 'test-tenant-id'
const CID = 'c1'

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

const DETAIL = {
  campaign: {
    id: CID,
    name: 'My Live Campaign',
    status: 'ENABLED',
    strategy: 'TARGET_CPA',
    budgetMicros: 50_000_000,
    metrics: {
      impressions: '1000',
      clicks: '50',
      cost: '120',
      conversions: '10',
      cpa: '12',
      ctr: '5%',
      searchImpressionShare: '0.6',
    },
    history: [],
    adGroups: [],
  },
  wow: {
    cur: { impressions: 1000, clicks: 50, cost: 120, conversions: 10 },
    prev: { impressions: 900, clicks: 45, cost: 110, conversions: 8 },
  },
  budgetPacing: null,
  client: { id: 'cl1' },
  openAlerts: [],
}

async function seedLive(page: import('@playwright/test').Page) {
  await page.addInitScript(
    (args: { key: string; value: string }) => sessionStorage.setItem(args.key, args.value),
    { key: SESSION_KEY, value: JSON.stringify(SESSION_FIXTURE) },
  )
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'test-token',
        user: SESSION_FIXTURE.user,
        tenant_id: TENANT,
        permissions: [],
      }),
    }),
  )

  const data = (v: unknown) =>
    ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: v }) }) as const

  // db metrics: /admin/tenants/{t}/metrics?...
  await page.route('**/admin/tenants/*/metrics*', (route) => route.fulfill(data([])))
  // sub-resources catch-all (devices/hourly/keywords/quality-scores/search-terms) → []
  await page.route('**/admin/tenants/*/campaigns/live/*/**', (route) => route.fulfill(data([])))
  // impression-share returns null (registered AFTER the catch-all so it wins)
  await page.route('**/admin/tenants/*/campaigns/live/*/impression-share*', (route) =>
    route.fulfill(data(null)),
  )
  // bare detail (no sub-segment → not matched by the catch-all)
  await page.route('**/admin/tenants/*/campaigns/live/*', (route) => route.fulfill(data(DETAIL)))

  // $tenant layout + brand
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

test('live campaign dashboard renders header and tabs', async ({ page }) => {
  await seedLive(page)

  await page.goto(`/${TENANT}/ads/google/live/${CID}`)

  await expect(page.getByText('My Live Campaign')).toBeVisible()
  await expect(page.getByRole('tab', { name: /Real-time Performance/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Campaign History' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Search Intelligence' })).toBeVisible()
})
