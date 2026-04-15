import { getClients, getClientPosts } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const clients = await getClients();
	const client = clients.find(c => c.id === params.tenant);
	
	if (!client) {
		error(404, 'Client not found');
	}

	const posts = await getClientPosts(params.tenant);

	return {
		client_id: params.tenant,
		client,
		posts
	};
};
