import { getPost } from '$lib/api/posts'
import { error } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = async ({ params }) => {
	const id = params.filename.replace(/\.json$/, '')
	const post = await getPost(params.tenant, id).catch(() => null)

	if (!post) {
		error(404, 'Post not found')
	}

	return {
		client_id: params.tenant,
		post: {
			...post,
			client_id: post.tenant_id,
			filename: post.id + '.json',
			media_files: post.media_path ? [post.media_path] : [],
		},
	}
}
