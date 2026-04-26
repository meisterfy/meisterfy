import { getAlerts, getAlertHistory } from '$lib/api/alerts'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = async ({ params, fetch }) => {
	const [alerts, history] = await Promise.all([
		getAlerts(params.tenant, fetch).catch(() => []),
		getAlertHistory(params.tenant, fetch).catch(() => []),
	])
	return { alerts, history }
}
