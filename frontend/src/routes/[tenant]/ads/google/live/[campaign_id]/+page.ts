import {
	getLiveCampaignDetail,
	getDbMetrics,
	getDeviceBreakdown,
	getHourlyBreakdown,
	getImpressionShare,
	getSearchTerms,
	getKeywordQualityScores,
	getKeywordPerformance
} from '$lib/api/campaigns'
import { withFallback } from '$lib/utils/loader'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ params, fetch, url }) => {
	const startDate = url.searchParams.get('startDate') ?? ''
	const endDate = url.searchParams.get('endDate') ?? ''
	const dateParams = { startDate, endDate }

	return {
		tenant: params.tenant,
		campaignId: params.campaign_id,
		streamed: {
			detail: withFallback(
				getLiveCampaignDetail(params.tenant, params.campaign_id, dateParams, fetch),
				null
			),
			dbHistory: withFallback(getDbMetrics(params.tenant, 180, params.campaign_id, fetch), []),
			devices: withFallback(
				getDeviceBreakdown(params.tenant, params.campaign_id, dateParams, fetch),
				[]
			),
			hourly: withFallback(
				getHourlyBreakdown(params.tenant, params.campaign_id, dateParams, fetch),
				[]
			),
			impressionShare: withFallback(
				getImpressionShare(params.tenant, params.campaign_id, dateParams, fetch),
				null
			),
			searchTerms: withFallback(
				getSearchTerms(params.tenant, params.campaign_id, dateParams, fetch),
				[]
			),
			qualityScores: withFallback(
				getKeywordQualityScores(params.tenant, params.campaign_id, fetch),
				[]
			),
			keywords: withFallback(
				getKeywordPerformance(params.tenant, params.campaign_id, dateParams, fetch),
				[]
			)
		}
	}
}
