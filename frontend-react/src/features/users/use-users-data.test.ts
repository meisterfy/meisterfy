import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useUsersData } from './use-users-data'
import type { AdminUser, AdminRole } from '@/lib/api/admin-users'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/admin-users', () => ({
  listTenantUsers: vi.fn(),
  listRoles: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeUser = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  locale: 'en-US',
  timezone: 'UTC',
  is_active: true,
  role: { id: 'r1', name: 'admin' },
  system_role: 'user',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

const makeRole = (overrides: Partial<AdminRole> = {}): AdminRole => ({
  id: 'r1',
  name: 'admin',
  tenant_id: 'tenant-a',
  permissions: ['read'],
  ...overrides,
})

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useUsersData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns populated arrays and isLoading=false after queries settle', async () => {
    const { listTenantUsers, listRoles } = await import('@/lib/api/admin-users')

    const activeUser = makeUser({ id: 'u1', is_active: true })
    const inactiveUser = makeUser({ id: 'u2', is_active: false, name: 'Bob' })
    const role = makeRole()

    vi.mocked(listTenantUsers).mockImplementation((_tenant, active) =>
      Promise.resolve(active ? [activeUser] : [inactiveUser]),
    )
    vi.mocked(listRoles).mockResolvedValue([role])

    const { result } = renderHook(
      () => useUsersData({ tenant: 'tenant-a' }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.users).toEqual([activeUser])
    expect(result.current.inactiveUsers).toEqual([inactiveUser])
    expect(result.current.roles).toEqual([role])
  })

  it('starts with isLoading=true', async () => {
    const { listTenantUsers, listRoles } = await import('@/lib/api/admin-users')
    vi.mocked(listTenantUsers).mockReturnValue(new Promise(() => {})) // never resolves
    vi.mocked(listRoles).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(
      () => useUsersData({ tenant: 'tenant-a' }),
      { wrapper: makeWrapper() },
    )

    expect(result.current.isLoading).toBe(true)
  })

  it('falls back to empty arrays when queries fail', async () => {
    const { listTenantUsers, listRoles } = await import('@/lib/api/admin-users')

    vi.mocked(listTenantUsers).mockRejectedValue(new Error('network error'))
    vi.mocked(listRoles).mockRejectedValue(new Error('network error'))

    const { result } = renderHook(
      () => useUsersData({ tenant: 'tenant-b' }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.users).toEqual([])
    expect(result.current.inactiveUsers).toEqual([])
    expect(result.current.roles).toEqual([])
  })

  it('exposes a refetch function', async () => {
    const { listTenantUsers, listRoles } = await import('@/lib/api/admin-users')

    vi.mocked(listTenantUsers).mockResolvedValue([])
    vi.mocked(listRoles).mockResolvedValue([])

    const { result } = renderHook(
      () => useUsersData({ tenant: 'tenant-a' }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(typeof result.current.refetch).toBe('function')
    // calling it should not throw
    expect(() => result.current.refetch()).not.toThrow()
  })
})
