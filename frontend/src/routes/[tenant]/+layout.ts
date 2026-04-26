import { getTenants, getTenant } from '$lib/api/tenants'
import { error } from '@sveltejs/kit'
import type { LayoutLoad } from './$types'

export const ssr = false

const toClient = (t: Awaited<ReturnType<typeof getTenant>>) => ({
	id: t.id,
	brand: {
		name: t.name,
		niche: t.niche,
		google_ads_id: t.google_ads_id,
		ads_monitoring: t.ads_monitoring,
	},
})

export const load: LayoutLoad = async ({ params, fetch }) => {
	const [tenant, tenants] = await Promise.all([
		getTenant(params.tenant, fetch).catch(() => null),
		getTenants(fetch).catch(() => []),
	])

	if (!tenant) {
		error(404, 'Client not found')
	}

	return {
		tenant: params.tenant,
		client: toClient(tenant),
		clients: tenants.map(toClient),
	}
}
