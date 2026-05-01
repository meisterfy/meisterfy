import { apiFetch } from './client'

export interface ConnectorResource {
	id: string
	tenant_id: string
	integration_id: string
	provider: string
	resource_type: string
	resource_id: string
	resource_name: string | null
	metadata: Record<string, unknown>
	created_at: string
	updated_at: string
}

export const getConnectorResources = (
	tenantId: string,
	provider: string,
	resourceType: string,
	fetchFn?: typeof fetch
) =>
	apiFetch<{ data: ConnectorResource[] }>(
		`/admin/tenants/${tenantId}/connectors?provider=${encodeURIComponent(provider)}&resource_type=${encodeURIComponent(resourceType)}`,
		{},
		fetchFn
	).then(r => r.data)

export interface PublishToMetaBody {
	post_id: string
	account_id: string
	platform: 'instagram' | 'facebook'
}

export const publishToMeta = (tenantId: string, body: PublishToMetaBody) =>
	apiFetch<{ data: { post_id: string; status: string; meta_post_id: string; platform: string; published_at: string } }>(
		`/admin/tenants/${tenantId}/meta/publish`,
		{ method: 'POST', body: JSON.stringify(body) }
	).then(r => r.data)
