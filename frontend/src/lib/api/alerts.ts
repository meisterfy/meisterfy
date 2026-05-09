import { apiFetch, apiFetchData } from './client'

export interface Alert {
	id: string
	tenant_id: string
	level: 'WARN' | 'CRITICAL'
	type: string
	campaign_id: string | null
	campaign_name: string | null
	message: string
	details: {
        action_suggested?: string;
        [key: string]: string | number | boolean | null | undefined;
    } | null
	resolved_at: string | null
	ignored_at: string | null
	created_at: string
}

export const getAlerts = (tenantId: string, fetchFn?: typeof fetch) =>
	apiFetchData<Alert[]>(`/admin/tenants/${tenantId}/alerts`, {}, fetchFn)

export const getAlertCount = (tenantId: string) =>
	apiFetch<{ count: number }>(`/admin/tenants/${tenantId}/alerts/count`)

export const getAlertHistory = (tenantId: string, fetchFn?: typeof fetch) =>
	apiFetchData<Alert[]>(`/admin/tenants/${tenantId}/alerts/history`, {}, fetchFn)

export const resolveAlert = (tenantId: string, id: string) =>
	apiFetch<void>(`/admin/tenants/${tenantId}/alerts/${id}/resolve`, { method: 'POST' })

export const ignoreAlert = (tenantId: string, id: string) =>
	apiFetch<void>(`/admin/tenants/${tenantId}/alerts/${id}/ignore`, { method: 'POST' })
