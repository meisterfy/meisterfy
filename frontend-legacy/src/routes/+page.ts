import { getTenants } from '$lib/api/tenants'
import { redirect, isRedirect } from '@sveltejs/kit'
import { withFallback } from '$lib/utils/loader'
import { bootstrapSessionToken } from '$lib/utils/session'
import type { PageLoad } from './$types'

// Connectors come from GET /admin/tenants (RBAC permissions). Do not gate on platform_admin here.
export const load: PageLoad = async ({ fetch }) => {
	bootstrapSessionToken()
	try {
		const tenants = await withFallback(getTenants(fetch), [])
		return { tenants }
	} catch (err) {
		if (isRedirect(err)) throw err
		const status = (err as { status?: number })?.status
		if (!status || status === 401) {
			throw redirect(302, '/login')
		}
		throw err
	}
}
