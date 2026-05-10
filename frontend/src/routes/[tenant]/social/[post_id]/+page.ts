import { getPost } from '$lib/api/posts'
import { normalizePost } from '$lib/utils/transforms'
import { error } from '@sveltejs/kit'
import { withFallback } from '$lib/utils/loader'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, parent }) => {
	const [post, { client }] = await Promise.all([
		withFallback(getPost(params.tenant, params.post_id), null),
		parent()
	])

	if (!post) {
		error(404, 'Post not found')
	}

	return {
		client_id: params.tenant,
		brand: client.brand,
		post: normalizePost(post)
	}
}
