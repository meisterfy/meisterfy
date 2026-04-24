import { getClients, getClientPosts } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const clients = await getClients();
	const client = clients.find(c => c.id === params.tenant);
	if (!client) error(404, 'Client not found');

	const all = await getClientPosts(params.tenant);

	// Calendar: posts that have a scheduled_date (scheduled or published)
	const scheduled = all.filter(p => p.scheduled_date);

	return { tenant: params.tenant, client, scheduled };
};
