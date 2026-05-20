import type { PageLoad } from './$types'
import { listMcpKeys } from '$lib/api/mcp-keys'

export const load: PageLoad = async ({ parent, fetch: fetchFn }) => {
	const { tenant } = await parent()
	return {
		tenant,
		keys: listMcpKeys(tenant, fetchFn).catch(() => [])
	}
}
