// @ts-nocheck
import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const ssr = false

export const load = ({ params }: Parameters<PageLoad>[0]) => {
	redirect(302, `/${params.tenant}/settings/general`)
}
