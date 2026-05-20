import { apiFetch, apiFetchData } from '$lib/api/client'

export interface LegalBlock {
	title: string
	content: string
}

export interface LegalVersion {
	id: string
	version: number
	fallback_locale: string
	translations: Record<string, LegalBlock[]>
	effective_at: string
	created_at: string
}

export const getLegalVersions = (fetchFn?: typeof fetch) =>
	apiFetchData<LegalVersion[]>('/admin/legal/versions', {}, fetchFn)

export const getLegalVersion = (id: string, fetchFn?: typeof fetch) =>
	apiFetchData<LegalVersion>(`/admin/legal/versions/${id}`, {}, fetchFn)

export const createLegalVersion = (body: {
	fallback_locale: string
	translations: Record<string, LegalBlock[]>
	effective_at: string
}) =>
	apiFetchData<LegalVersion>('/admin/legal/versions', {
		method: 'POST',
		body: JSON.stringify(body)
	})

export const updateLegalVersion = (
	id: string,
	body: Partial<{
		fallback_locale: string
		translations: Record<string, LegalBlock[]>
		effective_at: string
	}>
) => apiFetch<void>(`/admin/legal/versions/${id}`, { method: 'PUT', body: JSON.stringify(body) })

export const setUserSystemRole = (userId: string, systemRole: 'user' | 'platform_admin') =>
	apiFetch<void>(`/admin/users/${userId}/system-role`, {
		method: 'PUT',
		body: JSON.stringify({ system_role: systemRole })
	})
