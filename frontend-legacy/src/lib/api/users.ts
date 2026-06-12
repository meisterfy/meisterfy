import { apiFetch, apiFetchData } from './client'
import type { AuthUser } from '$lib/stores/auth.svelte'

export const updateMe = (
	body: Pick<AuthUser, 'name' | 'email' | 'locale'> & { timezone?: string }
) =>
	apiFetchData<AuthUser>('/auth/me', {
		method: 'PUT',
		body: JSON.stringify(body)
	})

// changePassword rotates the password server-side, which revokes every other
// session and returns a fresh access token for the current one. Callers must
// persist the returned access_token, otherwise the next request 401s.
export const changePassword = (body: { current_password: string; new_password: string }) =>
	apiFetch<{ access_token: string; expires_at: string }>('/auth/change-password', {
		method: 'POST',
		body: JSON.stringify(body)
	})
