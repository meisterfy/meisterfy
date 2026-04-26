import { getTenants } from '$lib/api/tenants'
import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = async ({ fetch: _ }) => {
	try {
		const tenants = await getTenants()
		if (tenants.length > 0) {
			redirect(302, `/${tenants[0].id}/social`)
		}
	} catch {
		// not authenticated or no tenants — fall through to show empty state
	}
	return {}
}
