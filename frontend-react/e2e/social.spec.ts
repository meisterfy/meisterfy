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
  // apiFetchData unwraps `.data`, so this endpoint must return the {data:[]}
  // envelope — a bare [] makes getConnectorResources resolve to undefined and
  // the page crashes on connectedPages.length before the provider list renders.
  await page.route('**/connectors*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  )
  // The picker (if opened) loads available meta pages.
  await page.route('**/meta/available-pages*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: emptyArray }),
  )
  // The $tenant layout loads the tenant + tenants list. Scope to the real
  // `/admin/` API path: a bare `**/tenants/*` also matches Vite's dev module
  // script `/src/routes/tenants/new.tsx` (eagerly imported by the route tree),
  // which would be served as JSON and break app boot.
  await page.route('**/admin/tenants/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: TENANT, name: 'Test Tenant' }),
    }),
  )
  await page.route('**/admin/tenants', (route) =>
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

// ── Social planner (/$tenant/social) ─────────────────────────────────────────

// Dedicated seed for the planner route. Globs are scoped to the real `/admin/`
// API paths so they never intercept Vite's dev module scripts (a broad
// `**/posts*` or `**/tenants/*` would match `/src/lib/api/posts.ts` /
// `/src/routes/tenants/new.tsx` and break app boot in dev).
async function seedPlanner(page: import('@playwright/test').Page) {
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

  // Scheduled posts load (getPosts(tenant,'scheduled')) → empty so it resolves
  // instantly rather than waiting on the down backend.
  await page.route('**/admin/tenants/*/posts*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
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

test('social planner page renders the calendar with backend down', async ({ page }) => {
  await seedPlanner(page)

  await page.goto(`/${TENANT}/social`)

  // Sub-toolbar nav + calendar legend are date-independent literals that prove
  // the layout + CalendarWidget mounted.
  await expect(page.getByRole('link', { name: 'Planner' })).toBeVisible()
  await expect(page.getByText('Scheduled')).toBeVisible()
  await expect(page.getByText('Published')).toBeVisible()
})

test('new-post drawer opens from a calendar cell', async ({ page }) => {
  await seedPlanner(page)

  await page.goto(`/${TENANT}/social`)

  await expect(page.getByRole('link', { name: 'Planner' })).toBeVisible()

  // Every day cell exposes a "New post" (aria-label) Plus button.
  await page.getByRole('button', { name: 'New post' }).first().click()

  // Drawer header + footer action prove NewPostDrawer mounted. (The drawer
  // renders both an sr-only Dialog.Title and the visible h2 named "New Post",
  // so scope to the visible one.)
  await expect(page.getByRole('heading', { name: 'New Post' }).last()).toBeVisible()
  await expect(page.getByRole('button', { name: /Add to Planner/ })).toBeVisible()
})

// ── Social drafts (/$tenant/social/drafts) ───────────────────────────────────

// The drafts route loads getPosts (all) + getConnectorResources, both via
// apiFetchData (which unwraps `.data`), so bodies use the {data:...} envelope.
async function seedDrafts(page: import('@playwright/test').Page, posts: unknown[] = []) {
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
  await page.route('**/admin/tenants/*/connectors*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  )
  await page.route('**/admin/tenants/*/posts*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: posts }) }),
  )
  await page.route('**/admin/tenants/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: TENANT, name: 'Test Tenant' } }),
    }),
  )
  await page.route('**/admin/tenants', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  )
}

test('social drafts page renders the empty state with backend down', async ({ page }) => {
  await seedDrafts(page, [])

  await page.goto(`/${TENANT}/social/drafts`)

  await expect(page.getByRole('link', { name: 'Drafts' })).toBeVisible()
  await expect(page.getByText('No drafts yet.')).toBeVisible()
})

test('social drafts page lists a draft and its actions', async ({ page }) => {
  await seedDrafts(page, [
    {
      id: 'draft-e2e',
      tenant_id: TENANT,
      status: 'draft',
      title: 'My e2e draft',
      content: 'Draft body',
      hashtags: [],
      platforms: ['instagram_feed'],
      media_path: null,
      media_type: null,
      connector_resource_id: null,
      workflow: null,
      scheduled_date: null,
      scheduled_time: null,
      published_at: null,
      created_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
    },
  ])

  await page.goto(`/${TENANT}/social/drafts`)

  await expect(page.getByText('My e2e draft')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible()
})
