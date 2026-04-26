import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = ({ params }) => {
	redirect(302, `/${params.tenant}/settings/general`)
}
