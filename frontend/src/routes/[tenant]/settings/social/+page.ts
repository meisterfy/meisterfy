import type { PageLoad } from './$types'
import { getConnectorResources } from '$lib/api/connector-resources'

export const load: PageLoad = async ({ parent, fetch }) => {
  const { tenant } = await parent()

  return {
    tenant,
    connectedPages: getConnectorResources(tenant, 'meta', 'page', fetch).catch(() => [])
  }
}
