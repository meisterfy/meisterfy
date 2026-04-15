import { getClientPosts } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const posts = await getClientPosts(params.tenant);
	const post = posts.find(p => p.filename === params.filename);
	
	if (!post) {
		error(404, 'Post not found');
	}

	return {
		client_id: params.tenant,
		post
	};
};
