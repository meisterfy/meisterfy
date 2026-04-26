import type { PageLoad } from './$types'

export const ssr = false

// Live campaign data will be served by the Go API in T17 (Google Ads connector)
export const load: PageLoad = ({ params }) => ({
	tenant: params.tenant,
	campaignId: params.campaign_id,
})
