import { setToken, clearToken, tryRefresh, getToken, apiFetch } from '$lib/api/client'
import { localeStore } from '$lib/stores/locale.svelte'

export interface AuthUser {
	id: string
	name: string
	email: string
	tenant_id: string
	permissions: string[]
	locale: string
	timezone?: string
}

let _token = $state<string | null>(null)
let _user = $state<AuthUser | null>(null)

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

	setToken(t: string) {
		_token = t
		setToken(t)
	},

	setUser(u: AuthUser) {
		_user = u
	},

	clear() {
		_token = null
		_user = null
		clearToken()
	},

	async restoreSession(): Promise<boolean> {
		const ok = await tryRefresh()
		if (!ok) return false
		_token = getToken()
		try {
			const data = await apiFetch<Record<string, unknown>>('/auth/me')
			_user = (data['user'] ?? data['data'] ?? data) as AuthUser
			if (_user?.locale) {
				localeStore.init(_user.locale)
			}
			return true
		} catch {
			return false
		}
	}
}
