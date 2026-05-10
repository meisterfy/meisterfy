import { getTenants } from '$lib/api/tenants'
import { getIntegrations } from '$lib/api/integrations'
import { withFallback } from '$lib/utils/loader'
import type { PageLoad } from './$types'


export const load: PageLoad = ({ fetch }) => {
	return {
		data: withFallback(getIntegrations(fetch), { integrations: [], providers: [] }),
		tenants: withFallback(getTenants(fetch), [])
	}
}
