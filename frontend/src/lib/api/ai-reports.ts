import { apiFetch, apiFetchData } from './client'

export interface AIReport {
	id: string
	tenant_id: string
	campaign_id: string
	report_type: string
	content: string
	period_start: string | null
	period_end: string | null
	generated_at: string
	generated_by_name: string | null
	model: string | null
}

export const listAIReports = (tenantId: string, campaignId: string, type = 'instant', limit = 10, fetchFn?: typeof fetch) =>
	apiFetchData<AIReport[]>(
		`/admin/tenants/${tenantId}/campaigns/${campaignId}/ai-reports?type=${type}&limit=${limit}`,
		{},
		fetchFn
	)

export const saveAIReport = (tenantId: string, campaignId: string, body: {
	content: string
	report_type?: string
	model?: string | null
}) =>
	apiFetchData<AIReport>(
		`/admin/tenants/${tenantId}/campaigns/${campaignId}/ai-reports`,
		{ method: 'POST', body: JSON.stringify(body) }
	)
