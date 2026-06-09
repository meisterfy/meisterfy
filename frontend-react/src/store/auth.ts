import { create } from 'zustand'
import { setToken as setClientToken, clearToken as clearClientToken, getToken, doRefresh, apiFetch } from '../lib/api/client'
import i18n from '../lib/i18n'

export interface AuthUser {
  id: string
  name: string
  email: string
  tenant_id: string
  permissions: string[]
  locale: string
  timezone?: string
  system_role: 'user' | 'platform_admin'
}

export interface PendingTerms {
  version_id: string
  version: number
  locale: string
  blocks: { title: string; content: string }[]
}

interface CachedSession {
  user: AuthUser
  token: string
  expiresAt: number
  pendingTerms?: PendingTerms | null
}

const SESSION_KEY = 'meisterfy_session'

function loadSession(): CachedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as CachedSession) : null
  } catch {
    return null
  }
}

function saveSession(user: AuthUser, token: string, expiresAt: number) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user, token, expiresAt }))
  } catch {
    // sessionStorage unavailable (e.g. private mode with zero quota)
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore sessionStorage errors
  }
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  pendingTerms: PendingTerms | null
  isAuthenticated: () => boolean
  setToken: (t: string) => void
  setUser: (u: AuthUser) => void
  clear: () => void
  acceptTerms: (versionId: string) => Promise<void>
  restoreSession: () => Promise<boolean>
}

export const useAuth = create<AuthState>((set, get) => {
  function applyRefreshData(data: Record<string, unknown>) {
    const userBase = (data['user'] ?? {}) as Record<string, unknown>
    const user = {
      ...userBase,
      tenant_id: (data['tenant_id'] ?? userBase['tenant_id'] ?? '') as string,
      permissions: ((data['permissions'] ?? userBase['permissions']) as string[]) ?? [],
      system_role: (userBase['system_role'] ?? 'user') as 'user' | 'platform_admin'
    } as AuthUser
    const token = getToken()
    const pendingTerms = (data['pending_terms'] as PendingTerms | null) ?? null
    const raw = data['expires_at']
    const expiresAt = raw ? new Date(raw as string).getTime() : Date.now() + 14 * 60 * 1000
    if (token) saveSession(user, token, expiresAt)
    if (user.locale) i18n.changeLanguage(user.locale)
    set({ user, token, pendingTerms })
  }

  return {
    token: null,
    user: null,
    pendingTerms: null,
    isAuthenticated: () => get().token !== null,
    setToken: (t) => {
      setClientToken(t)
      set({ token: t })
    },
    setUser: (u) => {
      const token = get().token
      if (token) saveSession(u, token, Date.now() + 14 * 60 * 1000)
      set({ user: u })
    },
    clear: () => {
      clearClientToken()
      clearSession()
      set({ token: null, user: null, pendingTerms: null })
    },
    acceptTerms: async (versionId) => {
      await apiFetch('/auth/accept-terms', { method: 'POST', body: JSON.stringify({ version_id: versionId }) })
      set({ pendingTerms: null })
    },
    restoreSession: async () => {
      const cached = loadSession()
      if (cached && cached.expiresAt > Date.now()) {
        setClientToken(cached.token)
        if (cached.user.locale) i18n.changeLanguage(cached.user.locale)
        set({ token: cached.token, user: cached.user, pendingTerms: cached.pendingTerms ?? null })
        doRefresh()
          .then((data) => {
            if (data) applyRefreshData(data)
            else get().clear()
          })
          .catch(() => {})
        return true
      }
      const data = await doRefresh()
      if (!data) return false
      applyRefreshData(data)
      return true
    }
  }
})
