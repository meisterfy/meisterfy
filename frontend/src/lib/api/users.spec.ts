import { describe, it, expect, vi, afterEach } from 'vitest'
import { updateMe, changePassword } from './users'

function stubFetch(body: unknown, ok = true, status = 200) {
	const mock = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
	vi.stubGlobal('fetch', mock)
	return mock
}

afterEach(() => vi.restoreAllMocks())

describe('updateMe', () => {
	it('sends PUT to /auth/me', async () => {
		const mock = stubFetch({ data: { id: 'u1', name: 'Alice', email: 'alice@example.com', locale: 'en' } })
		await updateMe({ name: 'Alice', email: 'alice@example.com', locale: 'en' })
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/auth/me')
		expect(init.method).toBe('PUT')
	})

	it('sends all fields in the body', async () => {
		const mock = stubFetch({ data: { id: 'u1', name: 'Bob', email: 'bob@example.com', locale: 'pt' } })
		await updateMe({ name: 'Bob', email: 'bob@example.com', locale: 'pt', timezone: 'America/Sao_Paulo' })
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.name).toBe('Bob')
		expect(body.timezone).toBe('America/Sao_Paulo')
	})

	it('returns updated user', async () => {
		stubFetch({ data: { id: 'u1', name: 'Alice', email: 'alice@example.com', locale: 'en' } })
		const result = await updateMe({ name: 'Alice', email: 'alice@example.com', locale: 'en' })
		expect(result.id).toBe('u1')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'email already taken' }, false, 409)
		await expect(updateMe({ name: 'X', email: 'taken@example.com', locale: 'en' })).rejects.toThrow('email already taken')
	})
})

describe('changePassword', () => {
	it('sends POST to /auth/change-password', async () => {
		const mock = stubFetch({})
		await changePassword({ current_password: 'old', new_password: 'new123!' })
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/auth/change-password')
		expect(init.method).toBe('POST')
	})

	it('sends both passwords in the body', async () => {
		const mock = stubFetch({})
		await changePassword({ current_password: 'old', new_password: 'new123!' })
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.current_password).toBe('old')
		expect(body.new_password).toBe('new123!')
	})

	it('throws on wrong current password', async () => {
		stubFetch({ error: 'current password incorrect' }, false, 422)
		await expect(changePassword({ current_password: 'wrong', new_password: 'new123!' })).rejects.toThrow('current password incorrect')
	})
})
