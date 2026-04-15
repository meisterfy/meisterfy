import { getDetailedCampaign } from '$lib/server/googleAdsDetailed';
import { getClients } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const clients = await getClients();
	const client = clients.find(c => c.id === params.tenant);
	
	if (!client) {
		error(404, 'Client not found');
	}

	const startDate = url.searchParams.get('startDate') || undefined;
	const endDate = url.searchParams.get('endDate') || undefined;

	const campaign = await getDetailedCampaign(client.brand.google_ads_id, params.campaign_id, startDate, endDate);

	if (!campaign) {
		error(404, 'Live campaign not found in Google Ads');
	}

	return {
		tenant: params.tenant,
		client,
		campaign
	};
};