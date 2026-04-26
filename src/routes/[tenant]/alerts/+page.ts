import { getAlerts, getAlertHistory } from '$lib/api/alerts'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = async ({ params }) => {
	const [alerts, history] = await Promise.all([
		getAlerts(params.tenant).catch(() => []),
		getAlertHistory(params.tenant).catch(() => []),
	])
	return { alerts, history }
}
