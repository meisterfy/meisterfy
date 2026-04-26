import { getSchedule } from '$lib/api/schedule'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = async ({ params, fetch }) => {
	const data = await getSchedule(params.tenant, fetch).catch(() => ({
		last_run: null,
		runs: [],
		cron_command: '',
	}))
	return {
		tenant: params.tenant,
		lastRun: data.last_run,
		runs: data.runs,
		cronCommand: data.cron_command,
	}
}
