import { apiFetch, apiFetchData } from './client'

export interface AdsMonitoringConfig {
	// monitoring thresholds
	target_cpa_brl: number
	no_conversion_alert_days: number
	max_cpa_multiplier: number
	min_daily_impressions: number
	budget_underpace_threshold: number
	// automation
	sync_enabled: boolean
	ai_report_daily: boolean
	ai_report_weekly: boolean
	ai_report_monthly: boolean
	// adjustments (UI only)
	adjustments_enabled: boolean
	max_increase_pct: number
	max_increase_brl: number
	max_decrease_pct: number
	max_decrease_brl: number
	// automatic adjustments
	suggestions_enabled?: boolean
	min_campaign_age_days?: number
	adjustment_interval_days?: number
}

export interface ReportPrompts {
	instant?: string
	daily?: string
	weekly?: string
	monthly?: string
}

export interface TenantConnector {
	id: string
	name: string
	logo_svg: string
	logo_png: string
}

export interface Tenant {
	id: string
	name: string
	connectors?: TenantConnector[]
	language: string
	niche: string | null
	location: string | null
	primary_persona: string | null
	tone: string | null
	instructions: string | null
	hashtags: string[]
	ads_monitoring: AdsMonitoringConfig | null
	report_prompts: ReportPrompts | null
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

export const getGoogleAdsStatus = (tenantId: string, fetchFn?: typeof fetch) =>
	apiFetchData<{ connected: boolean }>(`/admin/tenants/${tenantId}/google-ads/status`, {}, fetchFn)
