import { getTenants } from '$lib/api/tenants'
import { getIntegrations } from '$lib/api/integrations'
import { redirect, isRedirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'


export const load: PageLoad = async ({ fetch }) => {
	try {
		const [tenants, integrationsData] = await Promise.all([
			getTenants(fetch),
			getIntegrations(fetch).catch(() => ({ integrations: [], providers: [] }))
		])

		// Map integrations to tenants for easy access
		const tenantsWithIcons = tenants.map((tenant) => {
			const connectedIntegrations = integrationsData.integrations.filter(
				(i) => i.tenant_ids.includes(tenant.id) && i.status === 'connected'
			)

			// Get unique providers
			const uniqueProviders = Array.from(new Set(connectedIntegrations.map((i) => i.provider)))

			const connectors = uniqueProviders.map((pId) => {
				const provider = integrationsData.providers.find((p) => p.provider === pId)
				return {
					id: pId,
					name: provider?.display_name ?? pId
				}
			})

			return { ...tenant, connectors }
		})

		return { tenants: tenantsWithIcons }
	} catch (err: unknown) {
		if (isRedirect(err)) throw err
		const status = (err as { status?: number })?.status
		if (!status || status === 401 || status === 403) {
			redirect(302, '/login')
		}
		throw err
	}
}
