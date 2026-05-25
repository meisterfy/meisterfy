import { getToken, setToken } from '$lib/api/client'
import type { AuthUser } from '$lib/stores/auth.svelte'

const SESSION_KEY = 'meisterfy_session'

interface CachedSession {
	user: AuthUser
	token: string
	expiresAt: number
}

/** Reads the cached user from sessionStorage (safe during route loaders). */
export function getCachedSessionUser(): AuthUser | null {
	if (typeof sessionStorage === 'undefined') return null
	try {
		const raw = sessionStorage.getItem(SESSION_KEY)
		if (!raw) return null
		const cached = JSON.parse(raw) as CachedSession
		if (!cached.expiresAt || cached.expiresAt <= Date.now()) return null
		return cached.user ?? null
	} catch {
		return null
	}
}

/** Restores the API bearer token from sessionStorage before route loaders run. */
export function bootstrapSessionToken(): void {
	if (typeof sessionStorage === 'undefined' || getToken()) return
	try {
		const raw = sessionStorage.getItem(SESSION_KEY)
		if (!raw) return
		const cached = JSON.parse(raw) as { token?: string; expiresAt?: number }
		if (cached.token && cached.expiresAt && cached.expiresAt > Date.now()) {
			setToken(cached.token)
		}
	} catch {
		/* ignore */
	}
}
