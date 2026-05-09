import { apiFetch, apiFetchData } from './client'

export interface AdsMonitoringConfig {
	target_cpa_brl: number
	no_conversion_alert_days: number
	max_cpa_multiplier: number
	min_daily_impressions: number
	budget_underpace_threshold: number
}

export interface Tenant {
	id: string
	name: string
	language: string
	niche: string | null
	location: string | null
	primary_persona: string | null
	tone: string | null
	instructions: string | null
	hashtags: string[]
	ads_monitoring: AdsMonitoringConfig | null
	created_at: string
	updated_at: string
}

export const getTenants = (fetchFn?: typeof fetch) =>
	apiFetchData<Tenant[]>('/admin/tenants', {}, fetchFn)

export const getTenant = (id: string, fetchFn?: typeof fetch) =>
	apiFetchData<Tenant>(`/admin/tenants/${id}`, {}, fetchFn)

export const createTenant = (body: Partial<Tenant>) =>
	apiFetchData<Tenant>('/admin/tenants', { method: 'POST', body: JSON.stringify(body) })

export const updateTenant = (id: string, body: Partial<Tenant>) =>
	apiFetchData<Tenant>(`/admin/tenants/${id}`, {
		method: 'PUT',
		body: JSON.stringify(body)
	})

export const deleteTenant = (id: string) =>
	apiFetch<void>(`/admin/tenants/${id}`, { method: 'DELETE' })
