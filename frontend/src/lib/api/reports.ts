import { apiFetch, apiFetchData } from './client'

export type ReportType = 'audit' | 'search' | 'weekly' | 'monthly' | 'alert' | 'report'

export interface ReportListItem {
	id: string
	tenant_id: string
	slug: string
	type: ReportType
	title: string | null
	created_at: string
}

export interface Report extends ReportListItem {
	content: string
}

export const getReports = (tenantId: string, fetchFn?: typeof fetch) =>
	apiFetchData<ReportListItem[]>(`/admin/tenants/${tenantId}/reports`, {}, fetchFn)

export const getReport = (tenantId: string, slug: string) =>
	apiFetchData<Report>(`/admin/tenants/${tenantId}/reports/${slug}`)

export const createReport = (
	tenantId: string,
	body: { slug: string; content: string; title?: string; type?: ReportType }
) =>
	apiFetchData<Report>(`/admin/tenants/${tenantId}/reports`, {
		method: 'POST',
		body: JSON.stringify(body)
	})

export const deleteReport = (tenantId: string, id: string) =>
	apiFetch<void>(`/admin/tenants/${tenantId}/reports/${id}`, { method: 'DELETE' })
