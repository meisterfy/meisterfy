import type { LayoutLoad } from './$types'

export const ssr = false

export const load: LayoutLoad = ({ fetch, url }) => {
	const exempt = ['/setup', '/login', '/auth']
	if (exempt.some((p) => url.pathname.startsWith(p))) return {}

	// Verifica setup em background — não bloqueia render
	fetch('/health')
		.then((res) => res.json())
		.then((data) => {
			if (data?.setup_required) window.location.replace('/setup')
		})
		.catch(() => {})

	return {}
}
