import { apiFetch } from './client'

export type IntegrationProvider = 'google_ads' | 'meta' | 'canva'
export type IntegrationStatus = 'pending' | 'connected' | 'error'

export interface Integration {
	id: string
	name: string
	provider: IntegrationProvider
	oauth_client_id: string | null
	oauth_client_secret: string | null
	developer_token: string | null
	login_customer_id: string | null
	refresh_token: string | null
	status: IntegrationStatus
	error_message: string | null
	created_at: string
	updated_at: string
}

export interface IntegrationWithClients extends Integration {
	clients: string[]
}

export const getIntegrations = () =>
	apiFetch<{ data: IntegrationWithClients[] }>('/admin/integrations').then(r => r.data)

export const createIntegration = (body: Partial<Integration> & { client_ids?: string[] }) =>
	apiFetch<{ data: IntegrationWithClients }>('/admin/integrations', {
		method: 'POST',
		body: JSON.stringify(body),
	}).then(r => r.data)

export const updateIntegration = (id: string, body: Partial<Integration> & { client_ids?: string[] }) =>
	apiFetch<{ data: IntegrationWithClients }>(`/admin/integrations/${id}`, {
		method: 'PUT',
		body: JSON.stringify(body),
	}).then(r => r.data)

export const deleteIntegration = (id: string) =>
	apiFetch<void>(`/admin/integrations/${id}`, { method: 'DELETE' })
