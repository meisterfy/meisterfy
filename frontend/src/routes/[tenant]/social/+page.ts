import { getPosts } from '$lib/api/posts'
import { normalizePost } from '$lib/utils/transforms'
import { withFallback } from '$lib/utils/loader'
import type { PageLoad } from './$types'


export const load: PageLoad = ({ params, fetch }) => {
	const scheduled = withFallback(
		getPosts(params.tenant, 'scheduled', fetch).then((data) => data.map(normalizePost)),
		[]
	)

	return {
		tenant: params.tenant,
		scheduled
	}
}
