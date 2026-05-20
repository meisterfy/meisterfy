import { getTenants } from '$lib/api/tenants'
import { getIntegrations } from '$lib/api/integrations'
import { redirect, isRedirect } from '@sveltejs/kit'
import { withFallback } from '$lib/utils/loader'
import { auth } from '$lib/stores/auth.svelte'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ fetch }) => {
	try {
		const isPlatformAdmin = auth.user?.system_role === 'platform_admin'

		const [tenants, integrationsData] = await Promise.all([
			withFallback(getTenants(fetch), []),
			isPlatformAdmin
				? withFallback(getIntegrations(fetch), { integrations: [], providers: [] })
				: Promise.resolve({ integrations: [], providers: [] })
		])

		const tenantsWithIcons = tenants.map((tenant) => {
			const connectedIntegrations = integrationsData.integrations.filter(
				(i) => i.tenant_ids.includes(tenant.id) && i.status === 'connected'
			)
			const uniqueProviders = Array.from(new Set(connectedIntegrations.map((i) => i.provider)))
			const connectors = uniqueProviders.map((pId) => {
				const provider = integrationsData.providers.find((p) => p.provider === pId)
				return { id: pId, name: provider?.display_name ?? pId }
			})
			return { ...tenant, connectors }
		})

		return { tenants: tenantsWithIcons }
	} catch (err) {
		if (isRedirect(err)) throw err
		const status = (err as { status?: number })?.status
		if (!status || status === 401) {
			throw redirect(302, '/login')
		}
		throw err
	}
}
