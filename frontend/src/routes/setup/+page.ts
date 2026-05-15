import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/health')
	const data = await res.json()
	if (!data.setup_required) throw redirect(302, '/login')
	return {}
}
