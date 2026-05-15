import { describe, it, expect, vi, afterEach } from 'vitest'
import {
	getIntegrations,
	getIntegration,
	listProviders,
	createIntegration,
	updateIntegration,
	deleteIntegration,
	testIntegration,
	setIntegrationTenants
} from './integrations'
import type { Integration, IntegrationsPageData } from './integrations'

const mockIntegration: Integration = {
	id: 'i1',
	name: 'Meta Ads',
	provider: 'meta',
	group: 'ads',
	status: 'connected',
	error_message: null,
	tenant_ids: ['t1'],
	config: {},
	has_credentials: true,
	created_at: '2026-01-01T00:00:00Z',
	updated_at: '2026-01-01T00:00:00Z'
}

function stubFetch(body: unknown, ok = true, status = 200) {
	const mock = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
	vi.stubGlobal('fetch', mock)
	return mock
}

afterEach(() => vi.restoreAllMocks())

describe('getIntegrations', () => {
	it('calls /admin/integrations', async () => {
		const pageData: IntegrationsPageData = { integrations: [mockIntegration], providers: [] }
		const mock = stubFetch(pageData)
		await getIntegrations()
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/integrations')
	})

	it('returns page data with integrations and providers', async () => {
		const pageData: IntegrationsPageData = { integrations: [mockIntegration], providers: [] }
		stubFetch(pageData)
		const result = await getIntegrations()
		expect(result.integrations).toHaveLength(1)
		expect(result.providers).toEqual([])
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Unauthorized' }, false, 401)
		await expect(getIntegrations()).rejects.toThrow('Unauthorized')
	})
})

describe('getIntegration', () => {
	it('calls correct endpoint', async () => {
		const mock = stubFetch({ data: mockIntegration })
		await getIntegration('i1')
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/integrations/i1')
	})

	it('returns parsed integration', async () => {
		stubFetch({ data: mockIntegration })
		const result = await getIntegration('i1')
		expect(result.id).toBe('i1')
		expect(result.provider).toBe('meta')
	})

	it('throws on not found', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(getIntegration('missing')).rejects.toThrow('Not found')
	})
})

describe('listProviders', () => {
	it('calls /admin/integrations/providers', async () => {
		const mock = stubFetch({ data: [] })
		await listProviders()
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/integrations/providers')
	})

	it('returns provider list', async () => {
		stubFetch({ data: [{ provider: 'meta', group: 'ads', display_name: 'Meta' }] })
		const result = await listProviders()
		expect(result[0].provider).toBe('meta')
	})
})

describe('createIntegration', () => {
	it('sends POST to /admin/integrations', async () => {
		const mock = stubFetch({ data: mockIntegration })
		await createIntegration({ name: 'Meta', provider: 'meta' })
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/integrations')
		expect(init.method).toBe('POST')
	})

	it('sends the body as JSON', async () => {
		const mock = stubFetch({ data: mockIntegration })
		await createIntegration({ name: 'Meta', provider: 'meta', tenant_ids: ['t1'] })
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.name).toBe('Meta')
		expect(body.tenant_ids).toEqual(['t1'])
	})

	it('throws on validation error', async () => {
		stubFetch({ error: 'name required' }, false, 422)
		await expect(createIntegration({ name: '', provider: 'meta' })).rejects.toThrow('name required')
	})
})

describe('updateIntegration', () => {
	it('sends PUT to correct endpoint', async () => {
		const mock = stubFetch({ data: mockIntegration })
		await updateIntegration('i1', { name: 'Updated' })
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/integrations/i1')
		expect(init.method).toBe('PUT')
	})

	it('sends updated fields in body', async () => {
		const mock = stubFetch({ data: mockIntegration })
		await updateIntegration('i1', { name: 'New Name' })
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.name).toBe('New Name')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(updateIntegration('missing', {})).rejects.toThrow('Not found')
	})
})

describe('deleteIntegration', () => {
	it('sends DELETE to correct endpoint', async () => {
		const mock = stubFetch({})
		await deleteIntegration('i1')
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/integrations/i1')
		expect(init.method).toBe('DELETE')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(deleteIntegration('missing')).rejects.toThrow('Not found')
	})
})

describe('testIntegration', () => {
	it('sends POST to test endpoint', async () => {
		const mock = stubFetch({ ok: true })
		await testIntegration('i1')
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/integrations/i1/test')
		expect(init.method).toBe('POST')
	})

	it('returns ok:true on success', async () => {
		stubFetch({ ok: true })
		const result = await testIntegration('i1')
		expect(result.ok).toBe(true)
	})

	it('throws on connectivity error', async () => {
		stubFetch({ error: 'connection refused' }, false, 502)
		await expect(testIntegration('i1')).rejects.toThrow('connection refused')
	})
})

describe('setIntegrationTenants', () => {
	it('sends PUT to tenants endpoint with tenant_ids', async () => {
		const mock = stubFetch({})
		await setIntegrationTenants('i1', ['t1', 't2'])
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/integrations/i1/tenants')
		expect(init.method).toBe('PUT')
		const body = JSON.parse(init.body as string)
		expect(body.tenant_ids).toEqual(['t1', 't2'])
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(setIntegrationTenants('missing', [])).rejects.toThrow('Not found')
	})
})
