const BASE_URL = import.meta.env.VITE_API_URL ?? ''

let accessToken: string | null = null

export function setToken(token: string) { accessToken = token }
export function clearToken() { accessToken = null }
export function getToken() { return accessToken }

export async function apiFetch<T>(
	path: string,
	options: RequestInit = {}
): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		...options,
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			...(options.headers ?? {}),
		},
	})

	if (res.status === 401) {
		const refreshed = await tryRefresh()
		if (refreshed) {
			return apiFetch(path, options)
		}
		const e = Object.assign(new Error('Unauthorized'), { status: 401 })
		throw e
	}

	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: res.statusText }))
		const e = Object.assign(new Error(body.error ?? 'Request failed'), { status: res.status })
		throw e
	}

	return res.json()
}

async function tryRefresh(): Promise<boolean> {
	const res = await fetch(`${BASE_URL}/auth/refresh`, {
		method: 'POST',
		credentials: 'include',
	})
	if (!res.ok) return false
	const data = await res.json()
	if (data.access_token) {
		setToken(data.access_token)
		return true
	}
	return false
}

export { tryRefresh }
