import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearToken } from './client'
import { listTenantUsers, createTenantUser } from './admin-users'

beforeEach(() => clearToken())

describe('listTenantUsers', () => {
  it('requests the active-users path and returns the user array', async () => {
    const users = [{ id: 'u1', name: 'Alice', email: 'alice@example.com', locale: 'en', timezone: 'UTC', is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' }]

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: users }), { status: 200 }))

    const result = await listTenantUsers('tenant-123', true, fetchFn)

    const [url] = fetchFn.mock.calls[0] as [string, ...unknown[]]
    expect(url).toMatch('/admin/users?tenant_id=tenant-123&active=true')
    expect(result).toEqual(users)
  })
})

describe('createTenantUser', () => {
  it('issues a POST with the expected body including tenant_id', async () => {
    const created = { id: 'u2', name: 'Bob', email: 'bob@example.com', locale: 'en', timezone: 'UTC', is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' }

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: created }), { status: 200 }))

    vi.stubGlobal('fetch', fetchFn)

    await createTenantUser('tenant-456', {
      name: 'Bob',
      email: 'bob@example.com',
      password: 'secret',
      role_id: 'role-1',
      locale: 'en'
    })

    vi.unstubAllGlobals()

    const [, options] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body as string)
    expect(body).toMatchObject({ tenant_id: 'tenant-456', name: 'Bob', email: 'bob@example.com' })
  })
})
