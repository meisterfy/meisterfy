import type { PageLoad } from './$types'
import { listTenantUsers, listRoles } from '$lib/api/admin-users'

export const load: PageLoad = async ({ parent, fetch }) => {
	const { tenant } = await parent()
	return {
		tenant,
		users: listTenantUsers(tenant, true, fetch).catch(() => []),
		inactiveUsers: listTenantUsers(tenant, false, fetch).catch(() => []),
		roles: listRoles(fetch).catch(() => [])
	}
}
