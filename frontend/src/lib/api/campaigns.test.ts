import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearToken } from './client'
import { getCampaigns, createCampaign, getLiveCampaignDetail } from './campaigns'

beforeEach(() => clearToken())

describe('getCampaigns', () => {
  it('requests the campaigns path for the given tenant and returns the array', async () => {
    const campaigns = [{ id: 'c1', tenant_id: 't1', slug: 'summer', data: {} }]

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: campaigns }), { status: 200 }))

    const result = await getCampaigns('t1', fetchFn)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/tenants/t1/campaigns')
    expect(result).toEqual(campaigns)
  })
})

describe('createCampaign', () => {
  it('issues a POST with slug and data in the body', async () => {
    const created = { id: 'c2', tenant_id: 't1', slug: 'winter', data: { budget: 100 } }

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: created }), { status: 200 }))

    vi.stubGlobal('fetch', fetchFn)

    await createCampaign('t1', { slug: 'winter', data: { budget: 100 } })

    vi.unstubAllGlobals()

    const [url, options] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch('/admin/tenants/t1/campaigns')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body as string)
    expect(body).toMatchObject({ slug: 'winter', data: { budget: 100 } })
  })
})

describe('getLiveCampaignDetail', () => {
  it('appends date query params when provided', async () => {
    const detail = {
      campaign: { id: 'live-1', name: 'Test', status: 'ENABLED', strategy: 'TARGET_CPA', budgetMicros: 10000000, metrics: { impressions: '100', clicks: '10', cost: '5.00', conversions: '1', cpa: '5.00', searchImpressionShare: '0.5' }, history: [], adGroups: [] },
      wow: { cur: { impressions: 100, clicks: 10, cost: 5, conversions: 1 }, prev: { impressions: 80, clicks: 8, cost: 4, conversions: 1 } },
      budgetPacing: null,
      client: { id: 'cli-1' },
      openAlerts: []
    }

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: detail }), { status: 200 }))

    const result = await getLiveCampaignDetail('t1', 'live-1', { startDate: '2024-01-01', endDate: '2024-01-31' }, fetchFn)

    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/tenants/t1/campaigns/live/live-1')
    expect(url).toContain('startDate=2024-01-01')
    expect(url).toContain('endDate=2024-01-31')
    expect(result).toEqual(detail)
  })
})
