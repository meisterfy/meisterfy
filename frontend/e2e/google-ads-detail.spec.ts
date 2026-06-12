import { test, expect } from '@playwright/test'

const SESSION_KEY = 'meisterfy_session'
const TENANT = 'test-tenant-id'
const SLUG = '2026-01-01_promo'

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

async function seedDetail(page: import('@playwright/test').Page) {
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

  // getCampaign → /admin/tenants/{t}/campaigns/{slug}; apiFetchData unwraps `.data`.
  // Scope to the real /admin/ path so it never hits Vite's /src/lib/api/campaigns.ts.
  await page.route('**/admin/tenants/*/campaigns/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: SLUG,
          tenant_id: TENANT,
          slug: SLUG,
          data: {
            result: {
              id: SLUG,
              status: 'draft',
              platform: 'google_search',
              objective: 'Lead generation',
              budget_suggestion: 'R$ 100/day',
              ad_groups: [
                {
                  name: 'Brand terms',
                  keywords: ['meisterfy'],
                  negative_keywords: ['free'],
                  responsive_search_ad: { headlines: ['Hello'], descriptions: ['Desc'] },
                },
              ],
            },
            workflow: { reasoning: 'High-intent brand searches.' },
          },
        },
      }),
    }),
  )

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

test('campaign detail route loads and seeds the editor fields', async ({ page }) => {
  await seedDetail(page)

  await page.goto(`/${TENANT}/ads/google/${SLUG}`)

  await expect(page.getByRole('heading', { name: 'Edit Campaign' })).toBeVisible()
  await expect(page.getByLabel('Objective')).toHaveValue('Lead generation')
  await expect(page.getByLabel('Ad Group Name')).toHaveValue('Brand terms')
  await expect(page.getByText('High-intent brand searches.')).toBeVisible()
})
