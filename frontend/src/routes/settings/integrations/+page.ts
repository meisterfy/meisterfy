import { getTenants } from '$lib/api/tenants'
import { getIntegrations } from '$lib/api/integrations'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = async ({ fetch }) => {
	const [data, tenants] = await Promise.all([
		getIntegrations(fetch).catch(() => ({ integrations: [], providers: [] })),
		getTenants(fetch).catch(() => []),
	])
	const tenantOptions = tenants.map(t => ({ value: t.id, label: t.name }))
	return { ...data, tenantOptions }
}
