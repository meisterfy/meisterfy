import { describe, it, expect, vi, afterEach } from 'vitest'
import {
	getCampaigns,
	getCampaign,
	createCampaign,
	deleteCampaign,
	updateCampaign,
	getLiveCampaigns,
	getLiveCampaignDetail,
	syncHistory,
	getDbMetrics,
	getDeviceBreakdown,
	getHourlyBreakdown,
	getImpressionShare,
	getSearchTerms,
	getKeywordQualityScores,
	getKeywordPerformance,
	isSmartManaged
} from './campaigns'
import type { Campaign, LiveCampaign, AdGroup } from './campaigns'

const mockCampaign: Campaign = {
	id: 'c1',
	tenant_id: 't1',
	slug: 'main',
	data: { name: 'Main Campaign' }
}

const mockLiveCampaign: LiveCampaign = {
	id: 'lc1',
	name: 'Live Campaign',
	status: 'ENABLED',
	impressions: '1000',
	clicks: '50',
	cost: '100.00'
}

function stubFetch(body: unknown, ok = true, status = 200) {
	const mock = vi
		.fn()
		.mockResolvedValue({ ok, status, headers: new Headers(), json: async () => body })
	vi.stubGlobal('fetch', mock)
	return mock
}

afterEach(() => vi.restoreAllMocks())

describe('getCampaigns', () => {
	it('calls correct endpoint', async () => {
		const mock = stubFetch({ data: [mockCampaign] })
		await getCampaigns('t1')
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/campaigns')
	})

	it('returns campaign list', async () => {
		stubFetch({ data: [mockCampaign] })
		const result = await getCampaigns('t1')
		expect(result[0].slug).toBe('main')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Unauthorized' }, false, 401)
		await expect(getCampaigns('t1')).rejects.toThrow('Unauthorized')
	})
})

describe('getCampaign', () => {
	it('calls correct endpoint with slug', async () => {
		const mock = stubFetch({ data: mockCampaign })
		await getCampaign('t1', 'main')
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/campaigns/main')
	})

	it('returns the campaign', async () => {
		stubFetch({ data: mockCampaign })
		const result = await getCampaign('t1', 'main')
		expect(result.id).toBe('c1')
	})

	it('throws on not found', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(getCampaign('t1', 'missing')).rejects.toThrow('Not found')
	})
})

describe('createCampaign', () => {
	it('sends POST with slug and data', async () => {
		const mock = stubFetch({ data: mockCampaign })
		await createCampaign('t1', { slug: 'main', data: { name: 'Main' } })
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/tenants/t1/campaigns')
		expect(init.method).toBe('POST')
		const body = JSON.parse(init.body as string)
		expect(body.slug).toBe('main')
	})

	it('throws on validation error', async () => {
		stubFetch({ error: 'slug required' }, false, 422)
		await expect(createCampaign('t1', { slug: '', data: {} })).rejects.toThrow('slug required')
	})
})

describe('deleteCampaign', () => {
	it('sends DELETE to correct endpoint', async () => {
		const mock = stubFetch({})
		await deleteCampaign('t1', 'c1')
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/tenants/t1/campaigns/c1')
		expect(init.method).toBe('DELETE')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(deleteCampaign('t1', 'missing')).rejects.toThrow('Not found')
	})
})

describe('updateCampaign', () => {
	it('sends PUT to correct endpoint', async () => {
		const mock = stubFetch({ data: mockCampaign })
		await updateCampaign('t1', 'main', { name: 'Updated' })
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/tenants/t1/campaigns/main')
		expect(init.method).toBe('PUT')
	})

	it('wraps data in a data field', async () => {
		const mock = stubFetch({ data: mockCampaign })
		await updateCampaign('t1', 'main', { name: 'Updated' })
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.data.name).toBe('Updated')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(updateCampaign('t1', 'missing', {})).rejects.toThrow('Not found')
	})
})

describe('getLiveCampaigns', () => {
	it('calls live endpoint', async () => {
		const mock = stubFetch({ data: [mockLiveCampaign] })
		await getLiveCampaigns('t1')
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/campaigns/live')
	})

	it('returns live campaign list', async () => {
		stubFetch({ data: [mockLiveCampaign] })
		const result = await getLiveCampaigns('t1')
		expect(result[0].status).toBe('ENABLED')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'no integration' }, false, 503)
		await expect(getLiveCampaigns('t1')).rejects.toThrow('no integration')
	})
})

describe('getLiveCampaignDetail', () => {
	it('calls correct endpoint with campaign id', async () => {
		const mock = stubFetch({ data: {} })
		await getLiveCampaignDetail('t1', 'lc1', {})
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/campaigns/live/lc1')
	})

	it('appends startDate and endDate query params', async () => {
		const mock = stubFetch({ data: {} })
		await getLiveCampaignDetail('t1', 'lc1', { startDate: '2026-01-01', endDate: '2026-01-31' })
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('startDate=2026-01-01')
		expect(url).toContain('endDate=2026-01-31')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'campaign not found' }, false, 404)
		await expect(getLiveCampaignDetail('t1', 'missing', {})).rejects.toThrow('campaign not found')
	})
})

describe('syncHistory', () => {
	it('sends POST to sync-history endpoint', async () => {
		const mock = stubFetch({ data: { from: '2026-01-01', to: '2026-01-31', rows: 30 } })
		await syncHistory('t1')
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/tenants/t1/campaigns/sync-history')
		expect(init.method).toBe('POST')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'no integration' }, false, 503)
		await expect(syncHistory('t1')).rejects.toThrow('no integration')
	})
})

describe('getDbMetrics', () => {
	it('calls metrics endpoint with days and campaign_id query params', async () => {
		const mock = stubFetch({ data: [] })
		await getDbMetrics('t1', 30, 'c1')
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/metrics')
		expect(url).toContain('days=30')
		expect(url).toContain('campaign_id=c1')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(getDbMetrics('t1', 30, 'missing')).rejects.toThrow('Not found')
	})
})

describe('getDeviceBreakdown', () => {
	it('calls devices endpoint', async () => {
		const mock = stubFetch({ data: [] })
		await getDeviceBreakdown('t1', 'lc1', {})
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/campaigns/live/lc1/devices')
	})

	it('appends date range params', async () => {
		const mock = stubFetch({ data: [] })
		await getDeviceBreakdown('t1', 'lc1', { startDate: '2026-01-01' })
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('startDate=2026-01-01')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(getDeviceBreakdown('t1', 'missing', {})).rejects.toThrow('Not found')
	})
})

describe('getHourlyBreakdown', () => {
	it('calls hourly endpoint', async () => {
		const mock = stubFetch({ data: [] })
		await getHourlyBreakdown('t1', 'lc1', {})
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/campaigns/live/lc1/hourly')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(getHourlyBreakdown('t1', 'missing', {})).rejects.toThrow('Not found')
	})
})

describe('getImpressionShare', () => {
	it('calls impression-share endpoint', async () => {
		const mock = stubFetch({ data: null })
		await getImpressionShare('t1', 'lc1', {})
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/campaigns/live/lc1/impression-share')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(getImpressionShare('t1', 'missing', {})).rejects.toThrow('Not found')
	})
})

describe('getSearchTerms', () => {
	it('calls search-terms endpoint', async () => {
		const mock = stubFetch({ data: [] })
		await getSearchTerms('t1', 'lc1', {})
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/campaigns/live/lc1/search-terms')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(getSearchTerms('t1', 'missing', {})).rejects.toThrow('Not found')
	})
})

describe('getKeywordQualityScores', () => {
	it('calls quality-scores endpoint', async () => {
		const mock = stubFetch({ data: [] })
		await getKeywordQualityScores('t1', 'lc1')
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/campaigns/live/lc1/quality-scores')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(getKeywordQualityScores('t1', 'missing')).rejects.toThrow('Not found')
	})
})

describe('getKeywordPerformance', () => {
	it('calls keywords endpoint', async () => {
		const mock = stubFetch({ data: [] })
		await getKeywordPerformance('t1', 'lc1', {})
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/campaigns/live/lc1/keywords')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(getKeywordPerformance('t1', 'missing', {})).rejects.toThrow('Not found')
	})
})

describe('isSmartManaged', () => {
	const smartGroup: AdGroup = {
		id: '1',
		name: 'Smart Campaign Managed AdGroup',
		status: 'ENABLED',
		metrics: { impressions: 0, clicks: 0, cost: '0', conversions: 0 }
	}

	it('returns true for single smart ad group with zero impressions', () => {
		expect(isSmartManaged([smartGroup])).toBe(true)
	})

	it('returns false when multiple ad groups', () => {
		const other: AdGroup = { ...smartGroup, id: '2', name: 'Other Group' }
		expect(isSmartManaged([smartGroup, other])).toBe(false)
	})

	it('returns false when name does not include Smart Campaign keyword', () => {
		const regular: AdGroup = { ...smartGroup, name: 'Regular AdGroup' }
		expect(isSmartManaged([regular])).toBe(false)
	})

	it('returns false when impressions are non-zero', () => {
		const active: AdGroup = {
			...smartGroup,
			metrics: { impressions: 100, clicks: 5, cost: '10', conversions: 1 }
		}
		expect(isSmartManaged([active])).toBe(false)
	})
})
