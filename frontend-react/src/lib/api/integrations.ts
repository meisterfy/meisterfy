import { apiFetch, apiFetchData } from './client'

export type IntegrationProvider = string
export type IntegrationStatus = 'pending' | 'connected' | 'error'

export interface FieldSchema {
	key: string
	label: string
	placeholder?: string
	type: 'text' | 'password' | 'select' | 'url' | 'number'
	required: boolean
	help_text?: string
	options?: { label: string; value: string }[]
}

export interface ProviderSchema {
	provider: IntegrationProvider
	group: string
	display_name: string
	description: string
	logo_svg: string
	logo_png: string
	config_fields: FieldSchema[]
	credential_fields: FieldSchema[]
	oauth_flow: boolean
	oauth_start_path?: string
}

export interface Integration {
	id: string
	name: string
	provider: IntegrationProvider
	group: string
	status: IntegrationStatus
	error_message: string | null
	tenant_ids: string[]
	config: Record<string, string | null>
	has_credentials: boolean
	created_at: string
	updated_at: string
}

export interface IntegrationsPageData {
	integrations: Integration[]
	providers: ProviderSchema[]
}

export const getIntegrations = (fetchFn?: typeof fetch) =>
	apiFetch<IntegrationsPageData>('/admin/integrations', {}, fetchFn)

export const getIntegration = (id: string, fetchFn?: typeof fetch) =>
	apiFetchData<Integration>(`/admin/integrations/${id}`, {}, fetchFn)

export const listProviders = (fetchFn?: typeof fetch) =>
	apiFetchData<ProviderSchema[]>('/admin/integrations/providers', {}, fetchFn)

export interface CreateIntegrationBody {
	name: string
	provider: string
	oauth_client_id?: string | null
	oauth_client_secret?: string | null
	developer_token?: string | null
	login_customer_id?: string | null
	tenant_ids?: string[]
}

export const createIntegration = (body: CreateIntegrationBody) =>
	apiFetchData<Integration>('/admin/integrations', {
		method: 'POST',
		body: JSON.stringify(body)
	})

export const updateIntegration = (id: string, body: Partial<CreateIntegrationBody>) =>
	apiFetchData<Integration>(`/admin/integrations/${id}`, {
		method: 'PUT',
		body: JSON.stringify(body)
	})

export const deleteIntegration = (id: string) =>
	apiFetch<void>(`/admin/integrations/${id}`, { method: 'DELETE' })

export const testIntegration = (id: string) =>
	apiFetch<{ ok: boolean; error?: string }>(`/admin/integrations/${id}/test`, { method: 'POST' })

export const setIntegrationTenants = (id: string, tenantIds: string[]) =>
	apiFetch<void>(`/admin/integrations/${id}/tenants`, {
		method: 'PUT',
		body: JSON.stringify({ tenant_ids: tenantIds })
	})
