import { getCampaigns } from '$lib/api/campaigns'
import { getTenant } from '$lib/api/tenants'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = async ({ params, fetch }) => {
	const [tenant, rawCampaigns] = await Promise.all([
		getTenant(params.tenant, fetch).catch(() => null),
		getCampaigns(params.tenant, fetch).catch(() => []),
	])

	const campaigns = rawCampaigns.map(c => {
		const data = (c as { id: string; tenant_id: string; slug: string; data?: Record<string, unknown> }).data ?? {}
		const result = (data.result ?? {}) as Record<string, unknown>
		return {
			...result,
			client_id: params.tenant,
			filename: c.slug + '.json',
			workflow: (data.workflow ?? {}) as Record<string, unknown>,
		}
	})

	return {
		tenant: params.tenant,
		client: tenant ? {
			id: tenant.id,
			brand: { name: tenant.name, niche: tenant.niche, google_ads_id: tenant.google_ads_id },
		} : null,
		campaigns,
		streamed: { liveCampaigns: Promise.resolve([]) },
	}
}
