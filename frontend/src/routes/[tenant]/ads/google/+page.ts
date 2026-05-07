import { getCampaigns } from '$lib/api/campaigns'
import { getTenant } from '$lib/api/tenants'
import type { PageLoad } from './$types'


export const load: PageLoad = ({ params, fetch }) => {
	const tenant = getTenant(params.tenant, fetch)
		.then((t) => ({
			id: t.id,
			brand: { name: t.name, niche: t.niche, google_ads_id: t.google_ads_id }
		}))
		.catch(() => null)

	const campaigns = getCampaigns(params.tenant, fetch)
		.then((rawCampaigns) =>
			rawCampaigns.map((c) => {
				const data =
					(c as { id: string; tenant_id: string; slug: string; data?: Record<string, unknown> })
						.data ?? {}
				const result = (data.result ?? {}) as Record<string, unknown>
				return {
					...result,
					client_id: params.tenant,
					filename: c.slug + '.json',
					workflow: (data.workflow ?? {}) as Record<string, unknown>
				}
			})
		)
		.catch(() => [])

	return {
		tenant: params.tenant,
		client: tenant,
		campaigns,
		streamed: { liveCampaigns: Promise.resolve([]) }
	}
}
