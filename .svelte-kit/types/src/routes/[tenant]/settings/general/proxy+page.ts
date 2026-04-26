// @ts-nocheck
import { getTenant } from '$lib/api/tenants'
import { error } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const ssr = false

export const load = async ({ params }: Parameters<PageLoad>[0]) => {
	const tenant = await getTenant(params.tenant).catch(() => null)
	if (!tenant) error(404, 'Client not found')

	return {
		tenant: params.tenant,
		client: { id: tenant.id, brand: { name: tenant.name, niche: tenant.niche, google_ads_id: tenant.google_ads_id } },
		brand: {
			name: tenant.name,
			niche: tenant.niche ?? '',
			google_ads_id: tenant.google_ads_id ?? '',
		},
	}
}
