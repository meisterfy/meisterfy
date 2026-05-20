import type { PageLoad } from './$types'
import { listPendingAdjustments } from '$lib/api/pending-adjustments'

export const load: PageLoad = async ({ parent }) => {
	const { tenant } = await parent()
	return {
		tenant,
		pendingAdjustments: listPendingAdjustments(tenant, 'pending')
	}
}
