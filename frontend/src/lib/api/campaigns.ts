import { apiFetch, apiFetchData } from './client'

export interface CampaignListItem {
	id: string
	tenant_id: string
	slug: string
}

export interface Campaign extends CampaignListItem {
	data: Record<string, string | number | boolean | null | object>
}

export const getCampaigns = (tenantId: string, fetchFn?: typeof fetch) =>
	apiFetchData<Campaign[]>(`/admin/tenants/${tenantId}/campaigns`, {}, fetchFn)

export const getCampaign = (tenantId: string, slug: string) =>
	apiFetchData<Campaign>(`/admin/tenants/${tenantId}/campaigns/${slug}`)

export const createCampaign = (tenantId: string, body: { slug: string; data: Record<string, string | number | boolean | null | object> }) =>
	apiFetchData<Campaign>(`/admin/tenants/${tenantId}/campaigns`, {
		method: 'POST',
		body: JSON.stringify(body)
	})

export const deleteCampaign = (tenantId: string, id: string) =>
	apiFetch<void>(`/admin/tenants/${tenantId}/campaigns/${id}`, { method: 'DELETE' })

export const updateCampaign = (tenantId: string, slug: string, data: Record<string, string | number | boolean | null | object>) =>
	apiFetchData<Campaign>(`/admin/tenants/${tenantId}/campaigns/${slug}`, {
		method: 'PUT',
		body: JSON.stringify({ data })
	})

export const deployCampaign = (tenantId: string, id: string) =>
	apiFetch<void>(`/admin/tenants/${tenantId}/campaigns/${id}/deploy`, { method: 'POST' })
