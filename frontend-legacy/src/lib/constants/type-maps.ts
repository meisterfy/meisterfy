import { m } from '$lib/paraglide/messages'

export const REPORT_TYPE_MAP: Record<string, { label: string; color: string }> = {
	audit: { label: 'Audit', color: 'amber' },
	search: { label: m['globals:campaign_type_search'](), color: 'blue' },
	weekly: { label: 'Weekly', color: 'emerald' },
	monthly: { label: 'Monthly', color: 'violet' },
	alert: { label: 'Alert', color: 'red' },
	report: { label: 'Report', color: 'slate' }
}
