import { getSchedule } from '$lib/api/schedule'
import { withFallback } from '$lib/utils/loader'
import type { PageLoad } from './$types'


export const load: PageLoad = async ({ params, fetch }) => {
	const data = await withFallback(getSchedule(params.tenant, fetch), {
		last_run: null,
		runs: [],
		cron_command: ''
	})
	return {
		tenant: params.tenant,
		lastRun: data.last_run,
		runs: data.runs,
		cronCommand: data.cron_command
	}
}
