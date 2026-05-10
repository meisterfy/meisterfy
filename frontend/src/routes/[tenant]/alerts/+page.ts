import { getAlerts, getAlertHistory } from '$lib/api/alerts'
import { withFallback } from '$lib/utils/loader'
import type { PageLoad } from './$types'


export const load: PageLoad = async ({ params, fetch }) => {
	const [alerts, history] = await Promise.all([
		withFallback(getAlerts(params.tenant, fetch), []),
		withFallback(getAlertHistory(params.tenant, fetch), [])
	])
	return { alerts, history }
}
