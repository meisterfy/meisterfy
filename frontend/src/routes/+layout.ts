import { redirect, isRedirect } from '@sveltejs/kit'
import type { LayoutLoad } from './$types'

export const ssr = false

export const load: LayoutLoad = async ({ fetch, url }) => {
	const exempt = ['/setup', '/login', '/auth']
	if (exempt.some((p) => url.pathname.startsWith(p))) return {}

	try {
		const res = await fetch('/health')
		if (res.ok) {
			const data = await res.json()
			if (data.setup_required) throw redirect(302, '/setup')
		}
	} catch (err) {
		if (isRedirect(err)) throw err
		// backend unreachable — let the page load function handle auth redirect
	}
	return {}
}
