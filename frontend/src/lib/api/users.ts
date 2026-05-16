import { apiFetch, apiFetchData } from './client'
import type { AuthUser } from '$lib/stores/auth.svelte'

export const updateMe = (
	body: Pick<AuthUser, 'name' | 'email' | 'locale'> & { timezone?: string }
) =>
	apiFetchData<AuthUser>('/auth/me', {
		method: 'PUT',
		body: JSON.stringify(body)
	})

export const changePassword = (body: { current_password: string; new_password: string }) =>
	apiFetch<void>('/auth/change-password', {
		method: 'POST',
		body: JSON.stringify(body)
	})
