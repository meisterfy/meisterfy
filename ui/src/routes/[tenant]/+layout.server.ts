import { getClients } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => {
	const clients = await getClients();
	const client = clients.find(c => c.id === params.tenant);
	
	if (!client) {
		error(404, 'Client not found');
	}

	return {
		tenant: params.tenant,
		client
	};
};