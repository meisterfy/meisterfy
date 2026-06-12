import { getPosts } from '$lib/api/posts'
import { getConnectorResources } from '$lib/api/connector-resources'
import { normalizePost } from '$lib/utils/transforms'
import { withFallback } from '$lib/utils/loader'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, fetch }) => {
	const [all, metaAccounts] = await Promise.all([
		withFallback(getPosts(params.tenant, undefined, fetch), []),
		withFallback(getConnectorResources(params.tenant, 'meta', 'page', fetch), [])
	])
	const drafts = all
		.filter((p) => p.status === 'draft' || p.status === 'approved')
		.map(normalizePost)
	return { tenant: params.tenant, drafts, metaAccounts }
}
