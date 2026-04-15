import { getClientGoogleAds } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const campaigns = await getClientGoogleAds(params.tenant);
	const campaign = campaigns.find(c => c.filename === params.filename);
	
	if (!campaign) {
		error(404, 'Campaign not found');
	}

	return {
		tenant: params.tenant,
		campaign
	};
};