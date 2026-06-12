import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuth } from './auth'

beforeEach(() => {
  useAuth.getState().clear()
  sessionStorage.clear()
})

describe('auth store', () => {
  it('setToken makes it authenticated; clear resets', () => {
    useAuth.getState().setToken('T')
    expect(useAuth.getState().isAuthenticated()).toBe(true)
    useAuth.getState().clear()
    expect(useAuth.getState().isAuthenticated()).toBe(false)
  })

  it('restoreSession hydrates synchronously from a valid cache', async () => {
    const user = {
      id: '1',
      name: 'A',
      email: 'a@b.c',
      tenant_id: 't',
      permissions: [],
      locale: 'en',
      system_role: 'user' as const
    }
    sessionStorage.setItem('meisterfy_session', JSON.stringify({ user, token: 'T', expiresAt: Date.now() + 60000 }))
    // Background doRefresh must be a true no-op here: reject so .catch swallows and restored state is kept.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network')))
    const ok = await useAuth.getState().restoreSession()
    expect(ok).toBe(true)
    expect(useAuth.getState().user?.email).toBe('a@b.c')
    vi.unstubAllGlobals()
  })

  it('acceptTerms clears pendingTerms after a successful API call', async () => {
    // Set up a state with pendingTerms present
    const terms = {
      version_id: 'v1',
      version: 1,
      locale: 'en',
      blocks: [{ title: 'T', content: 'C' }]
    }
    // Manually inject pendingTerms into the store via the internal set pathway
    useAuth.setState({ pendingTerms: terms, token: 'T' })
    expect(useAuth.getState().pendingTerms).not.toBeNull()

    // Stub fetch to return a successful empty-body 204 for acceptTerms
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => '0' },
      json: async () => ({})
    }))

    await useAuth.getState().acceptTerms('v1')
    expect(useAuth.getState().pendingTerms).toBeNull()
    vi.unstubAllGlobals()
  })
})
