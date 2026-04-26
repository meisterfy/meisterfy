import { getCampaign } from '$lib/api/campaigns'
import { error } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = async ({ params }) => {
	const slug = params.filename.replace(/\.json$/, '')
	const c = await getCampaign(params.tenant, slug).catch(() => null)

	if (!c) {
		error(404, 'Campaign not found')
	}

	const data = (c.data ?? {}) as Record<string, unknown>
	const result = (data.result ?? {}) as Record<string, unknown>

	return {
		tenant: params.tenant,
		campaign: {
			...result,
			client_id: c.tenant_id,
			filename: c.slug + '.json',
			workflow: (data.workflow ?? {}) as Record<string, unknown>,
		},
	}
}
