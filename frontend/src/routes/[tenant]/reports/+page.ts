import { getReports } from '$lib/api/reports'
import { REPORT_TYPE_MAP } from '$lib/constants/type-maps'
import { withFallback } from '$lib/utils/loader'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ params, fetch }) => {
	const reports = withFallback(getReports(params.tenant, fetch), []).then((rows) =>
		rows.map((r) => {
			const dateMatch = r.slug.match(/(\d{4}-\d{2}-\d{2})/)
			return {
				slug: r.slug,
				date: dateMatch?.[1] ?? null,
				title: r.title ?? r.slug,
				...(REPORT_TYPE_MAP[r.type] ?? REPORT_TYPE_MAP.report)
			}
		})
	)

	return { tenant: params.tenant, reports }
}
