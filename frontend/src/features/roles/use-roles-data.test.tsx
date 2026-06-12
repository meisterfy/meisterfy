import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRolesData } from './use-roles-data'
import type { AdminRole, AdminPermission } from '@/lib/api/admin-users'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/admin-users', () => ({
  listRoles: vi.fn(),
  listPermissions: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeRole = (overrides: Partial<AdminRole> = {}): AdminRole => ({
  id: 'r1',
  name: 'admin',
  tenant_id: 'tenant-a',
  permissions: ['create:user'],
  ...overrides,
})

const makePermission = (name: string): AdminPermission => ({ id: name, name })

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRolesData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with isLoading=true', async () => {
    const mod = await import('@/lib/api/admin-users')
    vi.mocked(mod.listRoles).mockReturnValue(new Promise(() => {})) // never resolves
    vi.mocked(mod.listPermissions).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useRolesData())
    expect(result.current.isLoading).toBe(true)
  })

  it('exposes data and flips isLoading=false after both promises resolve', async () => {
    const mod = await import('@/lib/api/admin-users')
    const role = makeRole()
    const perm = makePermission('create:post')

    vi.mocked(mod.listRoles).mockResolvedValue([role])
    vi.mocked(mod.listPermissions).mockResolvedValue([perm])

    const { result } = renderHook(() => useRolesData())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.roles).toEqual([role])
    expect(result.current.allPermissions).toEqual([perm])
  })

  it('falls back to empty arrays when both API calls fail', async () => {
    const mod = await import('@/lib/api/admin-users')
    vi.mocked(mod.listRoles).mockRejectedValue(new Error('network error'))
    vi.mocked(mod.listPermissions).mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useRolesData())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.roles).toEqual([])
    expect(result.current.allPermissions).toEqual([])
  })

  it('falls back gracefully when only listRoles fails', async () => {
    const mod = await import('@/lib/api/admin-users')
    const perm = makePermission('create:post')
    vi.mocked(mod.listRoles).mockRejectedValue(new Error('roles error'))
    vi.mocked(mod.listPermissions).mockResolvedValue([perm])

    const { result } = renderHook(() => useRolesData())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.roles).toEqual([])
    expect(result.current.allPermissions).toEqual([perm])
  })

  it('exposes setRoles which can update the roles state', async () => {
    const mod = await import('@/lib/api/admin-users')
    const role = makeRole()
    vi.mocked(mod.listRoles).mockResolvedValue([role])
    vi.mocked(mod.listPermissions).mockResolvedValue([])

    const { result } = renderHook(() => useRolesData())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.roles).toEqual([role])

    const newRole = makeRole({ id: 'r2', name: 'editor' })
    act(() => {
      result.current.setRoles((prev) => [...prev, newRole])
    })

    expect(result.current.roles).toEqual([role, newRole])
  })
})
