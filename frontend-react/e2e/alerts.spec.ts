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

async function seedAlerts(
  page: import('@playwright/test').Page,
  adjustments: unknown[],
) {
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

  // listPendingAdjustments uses apiFetchData, which unwraps `.data`. Scope to the
  // real `/admin/` API path: a bare `**/pending-adjustments*` also matches Vite's
  // dev module script `/src/lib/api/pending-adjustments.ts`, which would be served
  // as JSON and break app boot (same gotcha noted in social.spec.ts).
  await page.route('**/admin/tenants/*/pending-adjustments*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: adjustments }),
    }),
  )

  // The $tenant layout loads the tenant + tenants list (see social.spec.ts).
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

test('alerts route renders a pending adjustment card', async ({ page }) => {
  await seedAlerts(page, [
    {
      id: 'a1',
      tenant_id: TENANT,
      campaign_resource_id: 'camp-1',
      adjustment_type: 'bid_increase',
      current_value: 100,
      proposed_value: 120,
      reason: 'CPA is trending down',
      status: 'pending',
      created_at: '2026-06-01T00:00:00Z',
      expires_at: null,
      resolved_at: null,
      resolved_by: null,
    },
  ])

  await page.goto(`/${TENANT}/alerts`)

  await expect(page.getByText('↑ Bid +20%')).toBeVisible()
  await expect(page.getByText('CPA is trending down')).toBeVisible()
})

test('alerts toolbar link is wired and navigates to the alerts route', async ({ page }) => {
  await seedAlerts(page, [])

  await page.goto(`/${TENANT}/social`)
  await page.getByRole('link', { name: 'Alerts' }).first().click()

  await expect(page).toHaveURL(new RegExp(`/${TENANT}/alerts$`))
})
