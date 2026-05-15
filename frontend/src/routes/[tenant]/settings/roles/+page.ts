import type { PageLoad } from './$types'
import { listRoles, listPermissions } from '$lib/api/admin-users'

export const load: PageLoad = async ({ parent, fetch }) => {
	const { tenant } = await parent()
	return {
		tenant,
		roles: listRoles(fetch).catch(() => []),
		allPermissions: listPermissions(fetch).catch(() => [])
	}
}
