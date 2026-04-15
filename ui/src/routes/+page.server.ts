import { getClients, getClientPosts } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const clients = await getClients();
	
	const clientsWithStats = await Promise.all(
		clients.map(async (client) => {
			const posts = await getClientPosts(client.id);
			return {
				...client,
				drafts: posts.filter(p => p.status === 'draft').length,
				approved: posts.filter(p => p.status === 'approved').length
			};
		})
	);

	return {
		clients: clientsWithStats
	};
};
