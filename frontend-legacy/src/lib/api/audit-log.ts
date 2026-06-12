import { apiFetch } from './client'

export interface AuditEntry {
	id: string
	user_id: string
	user_name: string
	action: string
	entity_type: string
	entity_id: string
	entity_name: string | null
	before: unknown
	after: unknown
	created_at: string
}

export interface AuditLogResponse {
	data: AuditEntry[]
	total: number
}

export interface AuditLogFilter {
	user_id?: string
	entity_type?: string
	entity_id?: string
	limit?: number
	offset?: number
}

export const getAuditLog = (
	tenantId: string,
	filter: AuditLogFilter = {},
	fetchFn?: typeof fetch
): Promise<AuditLogResponse> => {
	const params = new URLSearchParams()
	if (filter.user_id) params.set('user_id', filter.user_id)
	if (filter.entity_type) params.set('entity_type', filter.entity_type)
	if (filter.entity_id) params.set('entity_id', filter.entity_id)
	if (filter.limit) params.set('limit', String(filter.limit))
	if (filter.offset) params.set('offset', String(filter.offset))
	const qs = params.toString()
	return apiFetch<AuditLogResponse>(
		`/admin/tenants/${tenantId}/audit-log${qs ? `?${qs}` : ''}`,
		{},
		fetchFn
	)
}
