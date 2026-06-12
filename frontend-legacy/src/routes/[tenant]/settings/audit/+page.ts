import type { PageLoad } from './$types'
import { getAuditLog } from '$lib/api/audit-log'

export const load: PageLoad = async ({ parent, fetch }) => {
	const { tenant } = await parent()
	return {
		tenant,
		auditLog: getAuditLog(tenant, { limit: 50 }, fetch).catch(() => ({ data: [], total: 0 }))
	}
}
