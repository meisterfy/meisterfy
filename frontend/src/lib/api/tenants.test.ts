import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearToken } from './client'
import { getTenant } from './tenants'

beforeEach(() => clearToken())

describe('getTenant', () => {
  it('requests the tenant path containing the id and returns parsed data', async () => {
    const tenant = {
      id: 'abc',
      name: 'Acme',
      language: 'en',
      niche: null,
      location: null,
      primary_persona: null,
      tone: null,
      instructions: null,
      hashtags: [],
      ads_monitoring: null,
      report_prompts: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: tenant }), { status: 200 }))

    const result = await getTenant('abc', fetchFn)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/tenants/abc')
    expect(result).toEqual(tenant)
  })
})
