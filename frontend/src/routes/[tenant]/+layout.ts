import { getTenants, getTenant } from '$lib/api/tenants'
import { error } from '@sveltejs/kit'
import { withFallback } from '$lib/utils/loader'
import type { LayoutLoad } from './$types'

type TenantResult = Awaited<ReturnType<typeof getTenant>>

const toClientSummary = (t: TenantResult) => ({ id: t.id, brand: { name: t.name } })

const toClient = (t: TenantResult) => ({
	id: t.id,
	brand: {
		name: t.name,
		niche: t.niche,
		ads_monitoring: t.ads_monitoring,
		report_prompts: t.report_prompts,
		language: t.language,
		location: t.location,
		primary_persona: t.primary_persona,
		tone: t.tone,
		instructions: t.instructions,
		hashtags: t.hashtags
	}
})

export const load: LayoutLoad = async ({ params, fetch }) => {
	const tenant = await withFallback(getTenant(params.tenant, fetch), null)

	if (!tenant) {
		error(404, 'Client not found')
	}

	return {
		tenant: params.tenant,
		client: toClient(tenant),
		// lazy — não bloqueia o render inicial; o dropdown de troca de cliente carrega depois
		clients: getTenants(fetch)
			.then((ts) => ts.map(toClientSummary))
			.catch(() => [])
	}
}
