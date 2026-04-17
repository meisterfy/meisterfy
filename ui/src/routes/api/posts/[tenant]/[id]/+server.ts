import { json, error } from '@sveltejs/kit';
import { getClientPosts, updatePost } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const posts = await getClientPosts(params.tenant);
	const post = posts.find(p => p.id === params.id);

	if (!post) error(404, 'Post not found');

	await updatePost(params.tenant, post.filename, body);
	return json({ success: true });
};
