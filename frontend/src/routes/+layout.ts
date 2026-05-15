import { redirect } from '@sveltejs/kit'
import type { LayoutLoad } from './$types'

export const ssr = false

export const load: LayoutLoad = async ({ fetch, url }) => {
	const exempt = ['/setup', '/login', '/auth']
	if (exempt.some((p) => url.pathname.startsWith(p))) return {}

	const res = await fetch('/health')
	const data = await res.json()
	if (data.setup_required) throw redirect(302, '/setup')
	return {}
}
