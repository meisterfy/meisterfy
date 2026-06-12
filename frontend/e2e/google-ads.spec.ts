import { test, expect } from '@playwright/test'

const SESSION_KEY = 'meisterfy_session'
const TENANT = 'test-tenant-id'

// Mirrors CachedSession in src/store/auth.ts. No special permissions are needed
// to render the google-ads settings page (the page itself is auth-gated only).
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

async function seedSession(page: import('@playwright/test').Page) {
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

  const emptyData = JSON.stringify({ data: [] })

  // Mock Google Ads status — not connected (the simplest stable
  // backend-independent state). Scoped to the real nested `/admin/tenants/*/
  // google-ads/status` path; getGoogleAdsStatus calls apiFetchData, so the body
  // uses the `{data:...}` envelope.
  await page.route('**/admin/tenants/*/google-ads/status*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { connected: false } }),
    }),
  )

  // Mock AI providers — none configured (apiFetchData → `{data:...}` envelope).
  await page.route('**/admin/tenants/*/ai/providers*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: emptyData }),
  )

  // The $tenant layout (+ this route) loads the tenant + tenants list. Scoped to
  // the real `/admin/` path so they never intercept Vite's dev module scripts
  // (a bare `**/tenants/*` matches /src/routes/tenants/new.tsx). getTenant calls
  // apiFetchData → `{data:...}` envelope.
  await page.route('**/admin/tenants/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: TENANT,
          name: 'Test Tenant',
          ads_monitoring: null,
          report_prompts: null,
        },
      }),
    }),
  )
  await page.route('**/admin/tenants', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: emptyData }),
  )
}

test('google-ads settings: no-integration message renders when gads not connected', async ({ page }) => {
  await seedSession(page)

  await page.goto(`/${TENANT}/settings/google-ads`)

  // The no-integration amber box heading is the most stable "not connected" indicator.
  // This assertion is backend-independent: we fully mock all API calls above.
  await expect(page.getByText('No Google Ads integration connected.')).toBeVisible()

  // The integration link inside the amber box should be present.
  await expect(page.getByRole('link', { name: 'Integrations' })).toBeVisible()
})

// The following scenarios require a connected Google Ads account and real
// data from the backend, so they are intentionally skipped here and should
// be exercised in a dedicated integration-test environment:
//
//   - 4 config sections render when gads.connected = true
//   - Seeding form values from the tenant's ads_monitoring / report_prompts
//   - The save flow (Data Sync, Prompts, Adjustments sections)
//   - The help modal opening and displaying PROMPT_PARAMS
//   - Aggressive-warning amber box when age < 10 or interval < 5
