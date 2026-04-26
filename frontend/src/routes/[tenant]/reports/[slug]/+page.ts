import { getReport } from '$lib/api/reports'
import { error } from '@sveltejs/kit'
import { marked } from 'marked'
import type { PageLoad } from './$types'

marked.setOptions({ gfm: true })

export const ssr = false

export const load: PageLoad = async ({ params }) => {
	const report = await getReport(params.tenant, params.slug).catch(() => null)

	if (!report) {
		error(404, `Report "${params.slug}" not found`)
	}

	const html = await marked.parse(report.content)
	const dateMatch = params.slug.match(/(\d{4}-\d{2}-\d{2})/)

	return {
		tenant: params.tenant,
		slug: params.slug,
		date: dateMatch?.[1] ?? null,
		html,
	}
}
