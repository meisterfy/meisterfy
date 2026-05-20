import { setToken, clearToken, getToken, doRefresh, apiFetch } from '$lib/api/client'
import { localeStore } from '$lib/stores/locale.svelte'

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
	expiresAt: number // ms timestamp
}

const SESSION_KEY = 'mkt_session'

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
		// sessionStorage indisponível (ex: modo privado com quota zerada)
	}
}

function clearSession() {
	try {
		sessionStorage.removeItem(SESSION_KEY)
	} catch {}
}

let _token = $state<string | null>(null)
let _user = $state<AuthUser | null>(null)
let _pendingTerms = $state<PendingTerms | null>(null)

function applyRefreshData(data: Record<string, unknown>) {
	const userBase = (data['user'] ?? {}) as Record<string, unknown>
	_user = {
		...userBase,
		tenant_id: (data['tenant_id'] ?? userBase['tenant_id'] ?? '') as string,
		permissions: ((data['permissions'] ?? userBase['permissions']) as string[]) ?? [],
		system_role: (userBase['system_role'] ?? 'user') as 'user' | 'platform_admin'
	} as AuthUser
	_token = getToken()
	_pendingTerms = (data['pending_terms'] as PendingTerms | null) ?? null
	const raw = data['expires_at']
	const expiresAt = raw ? new Date(raw as string).getTime() : Date.now() + 14 * 60 * 1000
	saveSession(_user, _token!, expiresAt)
	if (_user?.locale) localeStore.init(_user.locale)
}

export const auth = {
	get token() {
		return _token
	},
	get user() {
		return _user
	},
	get isAuthenticated() {
		return _token !== null
	},
	get pendingTerms() {
		return _pendingTerms
	},

	setToken(t: string) {
		_token = t
		setToken(t)
	},

	setUser(u: AuthUser) {
		_user = u
		if (_token) saveSession(u, _token, Date.now() + 14 * 60 * 1000)
	},

	clear() {
		_token = null
		_user = null
		_pendingTerms = null
		clearToken()
		clearSession()
	},

	async acceptTerms(versionId: string): Promise<void> {
		await apiFetch('/auth/accept-terms', {
			method: 'POST',
			body: JSON.stringify({ version_id: versionId })
		})
		_pendingTerms = null
	},

	async restoreSession(): Promise<boolean> {
		const cached = loadSession()

		if (cached && cached.expiresAt > Date.now()) {
			// Cache válido — restaura imediatamente, renova em background
			setToken(cached.token)
			_token = cached.token
			_user = cached.user
			_pendingTerms = (cached as any).pendingTerms ?? null
			if (_user?.locale) localeStore.init(_user.locale)

			doRefresh()
				.then((data) => {
					if (data) applyRefreshData(data)
					else auth.clear()
				})
				.catch(() => {})

			return true
		}

		// Cache ausente ou expirado — precisa aguardar
		const data = await doRefresh()
		if (!data) return false
		applyRefreshData(data)
		return true
	}
}
