import { resolvePrompt } from './prompts'
import type { ReportPrompts } from '$lib/api/tenants'
import type {
	LiveCampaignDetail,
	SearchTermRow,
	KeywordPerfRow,
	KeywordQSRow
} from '$lib/api/campaigns'

export interface BrandContext {
	name: string
	niche: string | null
	location: string | null
	primary_persona: string | null
	tone: string | null
	instructions: string | null
	report_prompts: ReportPrompts | null
}

export function buildCampaignData(
	d: LiveCampaignDetail,
	terms: SearchTermRow[],
	kw: KeywordPerfRow[],
	qs: KeywordQSRow[]
): string {
	const m = d.campaign.metrics
	const budget = (d.campaign.budgetMicros / 1_000_000).toFixed(2)

	const topTerms = terms
		.sort((a, b) => b.clicks - a.clicks)
		.slice(0, 10)
		.map(
			(t) =>
				`- "${t.term}" | clicks: ${t.clicks} | cost: R$${t.cost.toFixed(2)} | conv: ${t.conversions} | CTR: ${(t.ctr * 100).toFixed(1)}%`
		)
		.join('\n')

	const topKw = kw
		.sort((a, b) => b.cost - a.cost)
		.slice(0, 10)
		.map(
			(k) =>
				`- [${k.matchType}] "${k.keywordText}" | ${k.adGroupName} | cost: R$${k.cost.toFixed(2)} | CPA: R$${k.cpa.toFixed(2)} | conv: ${k.conversions}`
		)
		.join('\n')

	const lowQS = qs
		.filter((k) => k.qualityScore <= 5)
		.slice(0, 5)
		.map(
			(k) =>
				`- "${k.keywordText}" QS: ${k.qualityScore}/10 | CTR: ${k.predictedCTR} | Creative: ${k.creativeQS} | Landing: ${k.postClickQS}`
		)
		.join('\n')

	return `Campaign: ${d.campaign.name}
Status: ${d.campaign.status} | Strategy: ${d.campaign.strategy} | Budget: R$${budget}/day

PERIOD METRICS:
- Impressions: ${m.impressions} | Clicks: ${m.clicks} | CTR: ~${parseFloat(m.clicks) > 0 ? ((parseFloat(m.clicks) / parseFloat(m.impressions)) * 100).toFixed(2) : 0}%
- Cost: R$${m.cost} | CPA: R$${m.cpa} | Conversions: ${m.conversions}
- Search Impression Share: ${m.searchImpressionShare}

TOP SEARCH TERMS BY CLICKS:
${topTerms || '(none)'}

TOP KEYWORDS BY SPEND:
${topKw || '(none)'}

LOW QUALITY SCORE KEYWORDS (≤5):
${lowQS || '(none found)'}`
}

export function buildChatSystemPrompt(brand: BrandContext, campaignData: string): string {
	return (
		resolvePrompt('instant', brand.report_prompts, brand) +
		'\n\nCAMPAIGN DATA (today):\n' +
		campaignData
	)
}
