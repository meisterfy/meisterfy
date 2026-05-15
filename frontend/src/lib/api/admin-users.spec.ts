import { describe, it, expect, vi, afterEach } from 'vitest'
import {
	listTenantUsers,
	createTenantUser,
	deactivateTenantUser,
	assignUserRole,
	listRoles,
	createRole,
	setRolePermissions,
	deleteRole,
	listPermissions
} from './admin-users'
import type { AdminUser, AdminRole } from './admin-users'

const mockUser: AdminUser = {
	id: 'u1',
	name: 'Alice',
	email: 'alice@example.com',
	locale: 'en',
	timezone: 'UTC',
	is_active: true,
	role: { id: 'r1', name: 'editor' },
	created_at: '2026-01-01T00:00:00Z',
	updated_at: '2026-01-01T00:00:00Z'
}

const mockRole: AdminRole = {
	id: 'r1',
	name: 'editor',
	tenant_id: null,
	permissions: ['posts:read', 'posts:write']
}

function stubFetch(body: unknown, ok = true, status = 200) {
	const mock = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
	vi.stubGlobal('fetch', mock)
	return mock
}

afterEach(() => vi.restoreAllMocks())

describe('listTenantUsers', () => {
	it('calls /admin/users', async () => {
		const mock = stubFetch({ data: [mockUser] })
		await listTenantUsers('t1')
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/users')
	})

	it('returns user list', async () => {
		stubFetch({ data: [mockUser] })
		const result = await listTenantUsers('t1')
		expect(result).toHaveLength(1)
		expect(result[0].email).toBe('alice@example.com')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Unauthorized' }, false, 401)
		await expect(listTenantUsers('t1')).rejects.toThrow('Unauthorized')
	})
})

describe('createTenantUser', () => {
	it('sends POST to /admin/users', async () => {
		const mock = stubFetch({ data: mockUser })
		await createTenantUser('t1', { name: 'Alice', email: 'a@b.com', password: 'pass', role_id: 'r1', locale: 'en' })
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/users')
		expect(init.method).toBe('POST')
	})

	it('includes tenant_id in the body', async () => {
		const mock = stubFetch({ data: mockUser })
		await createTenantUser('t1', { name: 'Alice', email: 'a@b.com', password: 'pass', role_id: 'r1', locale: 'en' })
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.tenant_id).toBe('t1')
		expect(body.email).toBe('a@b.com')
	})

	it('throws on validation error', async () => {
		stubFetch({ error: 'email in use' }, false, 409)
		await expect(
			createTenantUser('t1', { name: 'X', email: 'dup@b.com', password: 'pass', role_id: 'r1', locale: 'en' })
		).rejects.toThrow('email in use')
	})
})

describe('deactivateTenantUser', () => {
	it('sends DELETE to correct endpoint', async () => {
		const mock = stubFetch({})
		await deactivateTenantUser('u1')
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/users/u1')
		expect(init.method).toBe('DELETE')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(deactivateTenantUser('missing')).rejects.toThrow('Not found')
	})
})

describe('assignUserRole', () => {
	it('sends PUT to role endpoint', async () => {
		const mock = stubFetch({})
		await assignUserRole('u1', 'r2')
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/users/u1/role')
		expect(init.method).toBe('PUT')
	})

	it('sends role_id in body', async () => {
		const mock = stubFetch({})
		await assignUserRole('u1', 'r2')
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.role_id).toBe('r2')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'role not found' }, false, 404)
		await expect(assignUserRole('u1', 'missing')).rejects.toThrow('role not found')
	})
})

describe('listRoles', () => {
	it('calls /admin/roles', async () => {
		const mock = stubFetch({ data: [mockRole] })
		await listRoles()
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/roles')
	})

	it('returns role list', async () => {
		stubFetch({ data: [mockRole] })
		const result = await listRoles()
		expect(result[0].name).toBe('editor')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Unauthorized' }, false, 401)
		await expect(listRoles()).rejects.toThrow('Unauthorized')
	})
})

describe('createRole', () => {
	it('sends POST to /admin/roles', async () => {
		const mock = stubFetch({ data: mockRole })
		await createRole({ name: 'editor', permissions: ['posts:read'] })
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/roles')
		expect(init.method).toBe('POST')
	})

	it('sends name and permissions in body', async () => {
		const mock = stubFetch({ data: mockRole })
		await createRole({ name: 'editor', permissions: ['posts:read'] })
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.name).toBe('editor')
		expect(body.permissions).toContain('posts:read')
	})

	it('throws on duplicate name', async () => {
		stubFetch({ error: 'role already exists' }, false, 409)
		await expect(createRole({ name: 'editor', permissions: [] })).rejects.toThrow('role already exists')
	})
})

describe('setRolePermissions', () => {
	it('sends PUT to permissions endpoint', async () => {
		const mock = stubFetch({})
		await setRolePermissions('r1', ['posts:read', 'posts:write'])
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/roles/r1/permissions')
		expect(init.method).toBe('PUT')
	})

	it('sends permissions array in body', async () => {
		const mock = stubFetch({})
		await setRolePermissions('r1', ['posts:read'])
		const [, init] = mock.mock.calls[0] as [string, RequestInit]
		const body = JSON.parse(init.body as string)
		expect(body.permissions).toEqual(['posts:read'])
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(setRolePermissions('missing', [])).rejects.toThrow('Not found')
	})
})

describe('deleteRole', () => {
	it('sends DELETE to correct endpoint', async () => {
		const mock = stubFetch({})
		await deleteRole('r1')
		const [url, init] = mock.mock.calls[0] as [string, RequestInit]
		expect(url).toContain('/admin/roles/r1')
		expect(init.method).toBe('DELETE')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Not found' }, false, 404)
		await expect(deleteRole('missing')).rejects.toThrow('Not found')
	})
})

describe('listPermissions', () => {
	it('calls /admin/permissions', async () => {
		const mock = stubFetch({ data: [{ id: 'p1', name: 'posts:read' }] })
		await listPermissions()
		const [url] = mock.mock.calls[0] as [string]
		expect(url).toContain('/admin/permissions')
	})

	it('returns permission list', async () => {
		stubFetch({ data: [{ id: 'p1', name: 'posts:read' }] })
		const result = await listPermissions()
		expect(result[0].name).toBe('posts:read')
	})

	it('throws on error response', async () => {
		stubFetch({ error: 'Unauthorized' }, false, 401)
		await expect(listPermissions()).rejects.toThrow('Unauthorized')
	})
})
