import type { ReportPrompts } from '$lib/api/tenants'

export const DEFAULT_PROMPTS: Required<ReportPrompts> = {
	instant: `You are an expert Google Ads analyst for [brand_name].

Brand context:
- Niche: [brand_niche]
- Location: [brand_location]
- Target audience: [brand_persona]
- Tone: [brand_tone]

Analyze the following campaign data and provide a concise, actionable report. Focus on performance highlights, anomalies, and 2-3 specific recommendations to improve results.`,

	daily: `You are an expert Google Ads analyst for [brand_name].

Brand context:
- Niche: [brand_niche]
- Location: [brand_location]
- Target audience: [brand_persona]
- Tone: [brand_tone]

Review the daily campaign metrics below and provide a brief performance summary. Highlight any significant changes from the expected baseline, flag concerns, and suggest one priority action for the next 24 hours.`,

	weekly: `You are an expert Google Ads analyst for [brand_name].

Brand context:
- Niche: [brand_niche]
- Location: [brand_location]
- Target audience: [brand_persona]
- Tone: [brand_tone]

Analyze the weekly campaign performance data. Compare trends, identify patterns, and provide strategic recommendations for the coming week. Include budget efficiency and conversion quality in your assessment.`,

	monthly: `You are an expert Google Ads analyst for [brand_name].

Brand context:
- Niche: [brand_niche]
- Location: [brand_location]
- Target audience: [brand_persona]
- Tone: [brand_tone]

Conduct a comprehensive monthly review of the campaign data. Evaluate overall strategy effectiveness, ROI trends, audience insights, and provide 3-5 strategic recommendations for the next month.`
}

export interface PromptParam {
	key: string
	description: string
	example: string
}

export const PROMPT_PARAMS: PromptParam[] = [
	{ key: '[brand_name]', description: 'Brand / client name', example: 'Pórtico Imóveis' },
	{ key: '[brand_niche]', description: 'Market niche or segment', example: 'Real estate' },
	{ key: '[brand_location]', description: 'Geographic target', example: 'São Paulo, SP' },
	{ key: '[brand_persona]', description: 'Primary target audience persona', example: 'First-time homebuyers aged 28–45' },
	{ key: '[brand_tone]', description: 'Communication tone / voice', example: 'Professional and trustworthy' },
	{ key: '[brand_instructions]', description: 'Additional custom instructions', example: 'Always mention financing options' }
]

interface BrandData {
	name?: string
	niche?: string | null
	location?: string | null
	primary_persona?: string | null
	tone?: string | null
	instructions?: string | null
}

export function interpolate(template: string, brand: BrandData): string {
	return template
		.replace(/\[brand_name\]/g, brand.name ?? '')
		.replace(/\[brand_niche\]/g, brand.niche ?? '')
		.replace(/\[brand_location\]/g, brand.location ?? '')
		.replace(/\[brand_persona\]/g, brand.primary_persona ?? '')
		.replace(/\[brand_tone\]/g, brand.tone ?? '')
		.replace(/\[brand_instructions\]/g, brand.instructions ?? '')
}

export function resolvePrompt(
	type: keyof ReportPrompts,
	prompts: ReportPrompts | null | undefined,
	brand: BrandData
): string {
	const template = prompts?.[type] || DEFAULT_PROMPTS[type]
	return interpolate(template, brand)
}
