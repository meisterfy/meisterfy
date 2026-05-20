import { getPost, getPublishResults } from '$lib/api/posts'
import { normalizePost } from '$lib/utils/transforms'
import { error } from '@sveltejs/kit'
import { withFallback } from '$lib/utils/loader'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, fetch, parent }) => {
	const [post, results, { client }] = await Promise.all([
		withFallback(getPost(params.tenant, params.post_id), null),
		withFallback(getPublishResults(params.tenant, params.post_id, fetch), []),
		parent()
	])

	if (!post) {
		error(404, 'Post not found')
	}

	return {
		client_id: params.tenant,
		brand: client.brand,
		post: normalizePost(post),
		publishResults: results ?? []
	}
}
