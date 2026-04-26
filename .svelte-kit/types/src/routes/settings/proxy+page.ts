// @ts-nocheck
import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const ssr = false

export const load = () => {
	redirect(302, '/settings/integrations')
}
;null as any as PageLoad;