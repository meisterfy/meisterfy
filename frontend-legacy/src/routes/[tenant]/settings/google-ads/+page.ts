import type { PageLoad } from './$types'
import { getAIProviders } from '$lib/api/ai'
import { getGoogleAdsStatus } from '$lib/api/tenants'

export const load: PageLoad = async ({ parent, fetch }) => {
	const { tenant, client } = await parent()

	return {
		tenant,
		brand: client.brand,
		streamed: {
			providers: getAIProviders(tenant, fetch).catch(() => []),
			gadsStatus: getGoogleAdsStatus(tenant, fetch).catch(() => ({ connected: false }))
		}
	}
}
