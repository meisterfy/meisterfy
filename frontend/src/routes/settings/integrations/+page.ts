import { getTenants } from '$lib/api/tenants'
import { getIntegrations } from '$lib/api/integrations'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = async () => {
	const [integrations, tenants] = await Promise.all([
		getIntegrations().catch(() => []),
		getTenants().catch(() => []),
	])
	const clientOptions = tenants.map(t => ({ value: t.id, label: t.name }))
	return { integrations, clientOptions }
}
