// @ts-nocheck
import { getSchedule } from '$lib/api/schedule'
import type { PageLoad } from './$types'

export const ssr = false

export const load = async ({ params }: Parameters<PageLoad>[0]) => {
	const data = await getSchedule(params.tenant).catch(() => ({
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
