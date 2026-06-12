import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiFetch, apiFetchData, setToken, clearToken, getToken } from './client'

function stubFetch(...responses: object[]) {
	const mock = vi.fn()
	for (const r of responses) {
		mock.mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), ...r })
	}
	vi.stubGlobal('fetch', mock)
	return mock
}

afterEach(() => {
	vi.restoreAllMocks()
	clearToken()
})

describe('setToken / getToken / clearToken', () => {
	it('stores and retrieves a token', () => {
		setToken('tok123')
		expect(getToken()).toBe('tok123')
	})

	it('clearToken removes the stored token', () => {
		setToken('tok123')
		clearToken()
		expect(getToken()).toBeNull()
	})
})

describe('apiFetch', () => {
	it('attaches Authorization header when token is set', async () => {
		const mock = stubFetch({ json: async () => ({}) })
		setToken('mytoken')
		await apiFetch('/test')
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer mytoken')
	})

	it('omits Authorization header when no token', async () => {
		const mock = stubFetch({ json: async () => ({}) })
		await apiFetch('/test')
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined()
	})

	it('includes credentials and Content-Type by default', async () => {
		const mock = stubFetch({ json: async () => ({}) })
		await apiFetch('/test')
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(init.credentials).toBe('include')
		expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
	})

	it('throws with status and message on non-ok response', async () => {
		stubFetch({ ok: false, status: 422, json: async () => ({ error: 'Validation failed' }) })
		const err = (await apiFetch('/test').catch((e) => e)) as { message: string; status: number }
		expect(err.message).toBe('Validation failed')
		expect(err.status).toBe(422)
	})

	it('falls back to statusText when error body has no error field', async () => {
		stubFetch({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
			json: async () => ({})
		})
		const err = (await apiFetch('/test').catch((e) => e)) as { message: string }
		expect(err.message).toBe('Request failed')
	})

	it('retries after successful 401 token refresh', async () => {
		const mock = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ access_token: 'refreshed' })
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				headers: new Headers(),
				json: async () => ({ result: 'ok' })
			})
		vi.stubGlobal('fetch', mock)
		const result = await apiFetch<{ result: string }>('/test')
		expect(result.result).toBe('ok')
		expect(mock).toHaveBeenCalledTimes(3)
	})

	it('throws Unauthorized when refresh fails on 401', async () => {
		const mock = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
			.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
		vi.stubGlobal('fetch', mock)
		const err = (await apiFetch('/test').catch((e) => e)) as { message: string; status: number }
		expect(err.message).toBe('Unauthorized')
		expect(err.status).toBe(401)
	})
})

describe('apiFetchData', () => {
	it('unwraps the data field from the response', async () => {
		stubFetch({ json: async () => ({ data: [{ id: '1' }] }) })
		const result = await apiFetchData<{ id: string }[]>('/test')
		expect(result).toEqual([{ id: '1' }])
	})

	it('throws on non-ok response', async () => {
		stubFetch({ ok: false, status: 404, json: async () => ({ error: 'Not found' }) })
		const err = (await apiFetchData('/test').catch((e) => e)) as { message: string }
		expect(err.message).toBe('Not found')
	})
})
