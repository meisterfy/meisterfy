import { getCampaigns, getLiveCampaigns } from '$lib/api/campaigns'
import { normalizeCampaign } from '$lib/utils/transforms'
import { withFallback } from '$lib/utils/loader'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ params, fetch }) => {
	const campaigns = withFallback(getCampaigns(params.tenant, fetch), []).then((rawCampaigns) =>
		rawCampaigns.map((c) => normalizeCampaign(c, params.tenant))
	)

	return {
		campaigns,
		streamed: { liveCampaigns: withFallback(getLiveCampaigns(params.tenant, fetch), []) }
	}
}
