import { test, expect } from '@playwright/test'

const SESSION_KEY = 'meisterfy_session'
const TENANT = 'test-tenant-id'

// Mirrors CachedSession in src/store/auth.ts. No special permissions are needed
// to render the social-settings page (the page itself is auth-gated only).
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

  const emptyArray = JSON.stringify([])
  // The social page loads connector resources (connected meta pages).
  await page.route('**/connectors*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: emptyArray }),
  )
  // The picker (if opened) loads available meta pages.
  await page.route('**/meta/available-pages*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: emptyArray }),
  )
  // The $tenant layout loads the tenant + tenants list.
  await page.route('**/tenants/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: TENANT, name: 'Test Tenant' }),
    }),
  )
  await page.route('**/tenants', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: emptyArray }),
  )
}

test('social settings page renders with backend down', async ({ page }) => {
  await seedSession(page)

  await page.goto(`/${TENANT}/settings/social`)

  // The "Meta" provider label is a stable literal that proves the social
  // accounts card mounted without crashing.
  await expect(page.getByText('Meta', { exact: true })).toBeVisible()
  // The coming-soon providers are static literals too.
  await expect(page.getByText('LinkedIn')).toBeVisible()
})
