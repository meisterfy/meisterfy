import { getTenants } from '$lib/api/tenants'
import { getIntegrations } from '$lib/api/integrations'
import type { PageLoad } from './$types'


export const load: PageLoad = ({ fetch }) => {
	return {
		data: getIntegrations(fetch).catch(() => ({ integrations: [], providers: [] })),
		tenants: getTenants(fetch).catch(() => [])
	}
}
