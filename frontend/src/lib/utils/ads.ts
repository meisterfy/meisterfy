import { m } from '$lib/paraglide/messages'

export function formatStrategy(strategy: string) {
	const _m = m as Record<string, () => string>
	const maps: Record<string, string> = {
		TARGET_SPEND: _m['ads:strategies.target_spend'](),
		TARGET_CPA: _m['ads:strategies.target_cpa'](),
		MAXIMIZE_CONVERSIONS: _m['ads:strategies.maximize_conversions'](),
		MAXIMIZE_CONVERSION_VALUE: _m['ads:strategies.maximize_conversion_value'](),
		TARGET_ROAS: _m['ads:strategies.target_roas'](),
		MANUAL_CPC: _m['ads:strategies.manual_cpc'](),
		ENHANCED_CPC: _m['ads:strategies.enhanced_cpc'](),
		TARGET_IMPRESSION_SHARE: _m['ads:strategies.target_impression_share']()
	}
	return (
		maps[strategy] ||
		strategy
			.replace(/_/g, ' ')
			.toLowerCase()
			.replace(/\b\w/g, (l) => l.toUpperCase())
	)
}
