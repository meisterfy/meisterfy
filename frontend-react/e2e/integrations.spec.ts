import { test, expect } from '@playwright/test'

const SESSION_KEY = 'meisterfy_session'

// Shape mirrors CachedSession in src/store/auth.ts:
//   { user: AuthUser, token: string, expiresAt: number }
const SESSION_FIXTURE = {
  user: {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    tenant_id: 'test-tenant-id',
    permissions: [],
    locale: 'en',
    system_role: 'user',
  },
  token: 'test-token',
  expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour in the future
}

// Seed a valid session BEFORE the SPA boots, and mock /auth/refresh so that
// the background doRefresh() call does not race to clear the auth store.
async function seedSession(page: import('@playwright/test').Page) {
  // 1. Inject sessionStorage before any page JS runs
  await page.addInitScript((args: { key: string; value: string }) => {
    sessionStorage.setItem(args.key, args.value)
  }, { key: SESSION_KEY, value: JSON.stringify(SESSION_FIXTURE) })

  // 2. Intercept /auth/refresh so the background doRefresh() call returns a
  //    valid token rather than null (which would trigger get().clear())
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
}

test('integrations page renders with backend down (empty state, no crash)', async ({
  page,
}) => {
  await seedSession(page)

  await page.goto('/settings/integrations')

  // Page element must be visible — proves the route mounted without crashing
  await expect(page.getByTestId('integrations-page')).toBeVisible()
})

test('integrations page shows no_providers text when backend is down', async ({
  page,
}) => {
  await seedSession(page)

  await page.goto('/settings/integrations')

  await expect(page.getByTestId('integrations-page')).toBeVisible()

  // With the backend down, queries fall back to empty — expect the no_providers empty state
  await expect(page.getByText('No providers available.')).toBeVisible()
})
