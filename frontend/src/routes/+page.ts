import { getTenants } from '$lib/api/tenants'
import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = async () => {
	try {
		const tenants = await getTenants()
		if (tenants.length > 0) {
			redirect(302, `/${tenants[0].id}/social`)
		}
		// authenticated but no tenants yet — show empty state
		return {}
	} catch (err: unknown) {
		const status = (err as { status?: number })?.status
		// 401/403 → not logged in
		if (!status || status === 401 || status === 403) {
			redirect(302, '/login')
		}
		// server unreachable or other error → also send to login
		redirect(302, '/login')
	}
}
