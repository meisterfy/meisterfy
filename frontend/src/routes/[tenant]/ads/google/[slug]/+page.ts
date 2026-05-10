import { getCampaign } from '$lib/api/campaigns'
import { normalizeCampaign } from '$lib/utils/transforms'
import { error } from '@sveltejs/kit'
import { withFallback } from '$lib/utils/loader'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params }) => {
	const c = await withFallback(getCampaign(params.tenant, params.slug), null)

	if (!c) {
		error(404, 'Campaign not found')
	}

	return {
		tenant: params.tenant,
		campaign: normalizeCampaign(c, c.tenant_id)
	}
}
