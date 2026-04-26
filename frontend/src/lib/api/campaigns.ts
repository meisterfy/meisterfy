import { apiFetch } from './client'

export interface CampaignListItem {
	id: string
	tenant_id: string
	slug: string
}

export interface Campaign extends CampaignListItem {
	data: Record<string, unknown>
}

export const getCampaigns = (tenantId: string) =>
	apiFetch<{ data: CampaignListItem[] }>(`/admin/tenants/${tenantId}/campaigns`).then(r => r.data)

export const getCampaign = (tenantId: string, slug: string) =>
	apiFetch<{ data: Campaign }>(`/admin/tenants/${tenantId}/campaigns/${slug}`).then(r => r.data)

export const createCampaign = (tenantId: string, body: { slug: string; data: unknown }) =>
	apiFetch<{ data: Campaign }>(`/admin/tenants/${tenantId}/campaigns`, {
		method: 'POST',
		body: JSON.stringify(body),
	}).then(r => r.data)

export const deleteCampaign = (tenantId: string, id: string) =>
	apiFetch<void>(`/admin/tenants/${tenantId}/campaigns/${id}`, { method: 'DELETE' })

export const deployCampaign = (tenantId: string, id: string) =>
	apiFetch<void>(`/admin/tenants/${tenantId}/campaigns/${id}/deploy`, { method: 'POST' })
