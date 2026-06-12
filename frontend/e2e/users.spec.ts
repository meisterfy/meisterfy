import { test, expect } from '@playwright/test'

const SESSION_KEY = 'meisterfy_session'
const TENANT = 'test-tenant-id'

// Shape mirrors CachedSession in src/store/auth.ts:
//   { user: AuthUser, token: string, expiresAt: number }
// permissions include create:user + update:user so the invite button and edit
// actions render in the users route.
const SESSION_FIXTURE = {
  user: {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    tenant_id: TENANT,
    permissions: ['create:user', 'update:user'],
    locale: 'en',
    system_role: 'user',
  },
  token: 'test-token',
  expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour in the future
}

// Seed a valid session BEFORE the SPA boots, and mock /auth/refresh so that
// the background doRefresh() call does not race to clear the auth store.
// Also mock the users-route API endpoints so the three queries in useUsersData
// resolve immediately (avoiding slow network timeouts when the backend is down).
async function seedSession(page: import('@playwright/test').Page) {
  // 1. Inject sessionStorage before any page JS runs
  await page.addInitScript((args: { key: string; value: string }) => {
    sessionStorage.setItem(args.key, args.value)
  }, { key: SESSION_KEY, value: JSON.stringify(SESSION_FIXTURE) })

  // 2. Intercept /auth/refresh so the background doRefresh() call returns a
  //    valid token (with the same permissions) rather than null (which would
  //    trigger get().clear() and remove the auth store).
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'test-token',
        user: SESSION_FIXTURE.user,
        tenant_id: SESSION_FIXTURE.user.tenant_id,
        permissions: ['create:user', 'update:user'],
      }),
    }),
  )

  // 3. Mock the API endpoints that useUsersData fires so the loading state
  //    resolves instantly rather than timing out. Globs are scoped to the real
  //    `/admin/` API paths: a bare `**/roles*` / `**/tenants/*` also matches
  //    Vite's eagerly-imported dev module scripts (e.g. /src/routes/tenants/
  //    new.tsx), which would be served as JSON and break app boot. Bodies use
  //    the `{data:...}` envelope because getUsers/getRoles call apiFetchData
  //    (which unwraps `.data`) — a bare [] resolves to undefined and crashes
  //    on `.length`.
  const emptyData = JSON.stringify({ data: [] })
  await page.route('**/admin/users*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: emptyData }),
  )
  await page.route('**/admin/roles*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: emptyData }),
  )
  // Stub the tenant + tenants calls made by the $tenant layout.
  await page.route('**/admin/tenants/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: TENANT, name: 'Test Tenant' } }),
    }),
  )
  await page.route('**/admin/tenants', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: emptyData }),
  )
}

test('users page renders with backend down', async ({ page }) => {
  await seedSession(page)

  await page.goto(`/${TENANT}/settings/users`)

  // Container must be visible — proves the route mounted without crashing
  await expect(page.getByTestId('users-page')).toBeVisible()
})

test('invite drawer opens and shows fields', async ({ page }) => {
  await seedSession(page)

  await page.goto(`/${TENANT}/settings/users`)

  await expect(page.getByTestId('users-page')).toBeVisible()

  // The invite button renders because the session includes create:user.
  // Text is `+ Invite User` (t('users_invite') = "Invite User").
  const inviteButton = page.getByRole('button', { name: /invite/i })
  await expect(inviteButton).toBeVisible()
  await inviteButton.click()

  // Drawer title: t('users_invite_title') = "Invite User"
  await expect(page.getByRole('heading', { name: 'Invite User' })).toBeVisible()

  // Fields rendered by invite-drawer with aria-label attributes:
  //   t('users_invite_field_name')     = "Full name"
  //   t('users_invite_field_password') = "Password"
  await expect(page.getByLabel('Full name')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
})
