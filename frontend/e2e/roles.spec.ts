import { test, expect } from '@playwright/test'

const SESSION_KEY = 'meisterfy_session'
const TENANT = 'test-tenant-id'

// Shape mirrors CachedSession in src/store/auth.ts:
//   { user: AuthUser, token: string, expiresAt: number }
// permissions include create:role + update:role + delete:role so the New Role
// button and role actions render in the roles route.
const SESSION_FIXTURE = {
  user: {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    tenant_id: TENANT,
    permissions: ['create:role', 'update:role', 'delete:role'],
    locale: 'en',
    system_role: 'user',
  },
  token: 'test-token',
  expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour in the future
}

// Small fixture data — one system role, one custom role.
const ROLES_FIXTURE = [
  {
    id: 'r-system',
    name: 'owner',
    tenant_id: null,
    permissions: ['create:user', 'update:user'],
  },
  {
    id: 'r-custom',
    name: 'editor',
    tenant_id: TENANT,
    permissions: ['create:post'],
  },
]

const PERMISSIONS_FIXTURE = [
  { id: 'p1', name: 'create:user' },
  { id: 'p2', name: 'update:user' },
  { id: 'p3', name: 'create:post' },
]

// Seed a valid session BEFORE the SPA boots, mock /auth/refresh, and mock the
// roles-route API endpoints so the two queries in useRolesData resolve
// immediately (avoiding slow network timeouts when the backend is down).
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
        permissions: SESSION_FIXTURE.user.permissions,
      }),
    }),
  )

  // 3. Mock the two API endpoints that useRolesData fires. getRoles/
  //    getPermissions call apiFetchData (which unwraps `.data`), so the bodies
  //    use the `{data:...}` envelope — a bare array resolves to undefined.
  await page.route('**/admin/roles*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: ROLES_FIXTURE }),
    }),
  )
  await page.route('**/admin/permissions*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: PERMISSIONS_FIXTURE }),
    }),
  )

  // 4. Stub the tenant + tenants calls made by the $tenant layout. Scoped to
  //    the real `/admin/` path so they never intercept Vite's dev module
  //    scripts (a bare `**/tenants/*` matches /src/routes/tenants/new.tsx).
  await page.route('**/admin/tenants/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: TENANT, name: 'Test Tenant' } }),
    }),
  )
  await page.route('**/admin/tenants', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  )
}

test('roles page renders heading with backend down (mocked)', async ({ page }) => {
  await seedSession(page)

  await page.goto(`/${TENANT}/settings/roles`)

  // The section title "Roles & Permissions" from EN locale should be visible.
  // If backend-gated i18n loads correctly, this renders the translated string.
  // Backend-gated: we skip asserting the exact perm-matrix content since that
  // depends on backend data that is mocked via empty arrays in other specs.
  await expect(
    page.getByRole('heading', { name: /Roles|settings:roles_title/i }),
  ).toBeVisible({ timeout: 10_000 })
})

test('roles page auto-selects first role and shows its permissions', async ({ page }) => {
  await seedSession(page)

  await page.goto(`/${TENANT}/settings/roles`)

  // The "owner" role name (first in fixture) should be visible after data
  // loads. roleLabel maps the default backend name to "Owner" via i18n. It
  // appears twice — once in the role list and once in the auto-selected
  // detail panel heading — so scope to the first match to avoid strict-mode.
  await expect(
    page.getByText('Owner').or(page.getByText('owner')).first(),
  ).toBeVisible({ timeout: 10_000 })
})

test('roles page shows New Role button when create:role permission present', async ({ page }) => {
  await seedSession(page)

  await page.goto(`/${TENANT}/settings/roles`)

  // Wait for the page to finish loading (heading visible)
  await expect(
    page.getByRole('heading', { name: /Roles|settings:roles_title/i }),
  ).toBeVisible({ timeout: 10_000 })

  // "New Role" button must be visible (session includes create:role)
  await expect(page.getByRole('button', { name: /New Role/i })).toBeVisible()
})

// ── Backend-gated assertions (skipped) ───────────────────────────────────────
//
// The following scenarios require a real backend or more detailed fixture
// setup and are intentionally not asserted in this e2e spec:
//
// - Saving permissions: calls PUT /admin/roles/:id — would need PATCH mock +
//   deep interaction with the form state.
// - Deleting a role: calls DELETE /admin/roles/:id — requires a confirm dialog
//   flow that is well-covered in the unit tests (-roles.test.tsx).
// - Creating a role: calls POST /admin/roles — covered in unit tests.
// - The "cannot modify" system-role note: tested in unit tests.
