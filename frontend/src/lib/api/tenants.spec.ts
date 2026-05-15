import { describe, it, expect, vi, afterEach } from 'vitest'
import { getTenants, getTenant, createTenant, updateTenant, deleteTenant, getGoogleAdsStatus } from './tenants'
import type { Tenant } from './tenants'

const mockTenant: Tenant = {
	id: 't1',
	name: 'Acme',
	language: 'pt',
	niche: 'e-commerce',
	location: 'BR',
	primary_persona: null,
	tone: null,
	instructions: null,
	hashtags: [],
	ads_monitoring: null,
	report_prompts: null,
	created_at: '2026-01-01T00:00:00Z',
	updated_at: '2026-01-01T00:00:00Z'
}

function stubFetch(body: unknown, ok = true, status = 200) {
	const mock = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
	vi.stubGlobal('fetch', mock)
	return mock
}

afterEach(() => vi.restoreAllMocks())

describe('getTenants', () => {
	it('calls /admin/tenants', async () => {
		const mock = stubFetch({ data: [mockTenant] })
		await getTenants()
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants')
	})

	it('returns tenant list', async () => {
		stubFetch({ data: [mockTenant] })
		const result = await getTenants()
		expect(result).toHaveLength(1)
		expect(result[0].id).toBe('t1')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Unauthorized' }, false, 401)
		await expect(getTenants()).rejects.toThrow('Unauthorized')
	})
})

describe('getTenant', () => {
	it('calls correct endpoint', async () => {
		const mock = stubFetch({ data: mockTenant })
		await getTenant('t1')
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1')
	})

	it('returns the tenant', async () => {
		stubFetch({ data: mockTenant })
		const result = await getTenant('t1')
		expect(result.name).toBe('Acme')
	})

	it('throws on not found', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(getTenant('missing')).rejects.toThrow('Not found')
	})
})

describe('createTenant', () => {
	it('sends POST to /admin/tenants', async () => {
		const mock = stubFetch({ data: mockTenant })
		await createTenant({ name: 'New Tenant' })
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/tenants')
		expect(init.method).toBe('POST')
	})

	it('sends the body as JSON', async () => {
		const mock = stubFetch({ data: mockTenant })
		await createTenant({ name: 'New Tenant', language: 'en' })
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.name).toBe('New Tenant')
		expect(body.language).toBe('en')
	})

	it('returns the created tenant', async () => {
		stubFetch({ data: mockTenant })
		const result = await createTenant({ name: 'Acme' })
		expect(result.id).toBe('t1')
	})

	it('throws on validation error', async () => {
		stubFetch({ error: 'name required' }, false, 422)
		await expect(createTenant({})).rejects.toThrow('name required')
	})
})

describe('updateTenant', () => {
	it('sends PUT to correct endpoint', async () => {
		const mock = stubFetch({ data: mockTenant })
		await updateTenant('t1', { name: 'Updated' })
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/tenants/t1')
		expect(init.method).toBe('PUT')
	})

	it('sends updated fields in body', async () => {
		const mock = stubFetch({ data: mockTenant })
		await updateTenant('t1', { name: 'Updated', niche: 'fintech' })
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.name).toBe('Updated')
		expect(body.niche).toBe('fintech')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(updateTenant('missing', {})).rejects.toThrow('Not found')
	})
})

describe('deleteTenant', () => {
	it('sends DELETE to correct endpoint', async () => {
		const mock = stubFetch({})
		await deleteTenant('t1')
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/tenants/t1')
		expect(init.method).toBe('DELETE')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(deleteTenant('missing')).rejects.toThrow('Not found')
	})
})

describe('getGoogleAdsStatus', () => {
	it('calls correct endpoint', async () => {
		const mock = stubFetch({ data: { connected: true } })
		await getGoogleAdsStatus('t1')
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/tenants/t1/google-ads/status')
	})

	it('returns connection status', async () => {
		stubFetch({ data: { connected: true } })
		const result = await getGoogleAdsStatus('t1')
		expect(result.connected).toBe(true)
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(getGoogleAdsStatus('missing')).rejects.toThrow('Not found')
	})
})
