import { getClients } from '$lib/server/db';
import { error, fail } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PageServerLoad, Actions } from './$types';

const CLIENTS_DIR = path.resolve('../clients');

export const load: PageServerLoad = async ({ params }) => {
	const clients = await getClients();
	const client = clients.find((c) => c.id === params.tenant);
	if (!client) error(404, 'Client not found');

	let brand: Record<string, unknown> = {};
	try {
		brand = JSON.parse(
			await fs.readFile(path.join(CLIENTS_DIR, params.tenant, 'brand.json'), 'utf-8'),
		);
	} catch {}

	return { tenant: params.tenant, client, brand };
};

export const actions: Actions = {
	saveBrand: async ({ params, request }) => {
		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();
		const niche = (form.get('niche') as string)?.trim() ?? '';
		const google_ads_id = (form.get('google_ads_id') as string)?.trim() || undefined;

		if (!name) return fail(400, { error: 'Brand name is required' });

		const brandPath = path.join(CLIENTS_DIR, params.tenant, 'brand.json');
		let existing: Record<string, unknown> = {};
		try {
			existing = JSON.parse(await fs.readFile(brandPath, 'utf-8'));
		} catch {}

		const updated: Record<string, unknown> = { ...existing, name, niche };
		if (google_ads_id) updated.google_ads_id = google_ads_id;
		else delete updated.google_ads_id;

		await fs.writeFile(brandPath, JSON.stringify(updated, null, 2));
		return { success: true };
	},
};
