import fs from 'node:fs/promises';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CLIENTS_DIR = path.resolve('../clients');

function isValidSegment(s: string): boolean {
	return s === path.basename(s) && /^[a-z0-9][a-z0-9-_.]*$/i.test(s);
}

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const { client_id } = params;

	if (!isValidSegment(client_id)) {
		return json({ error: 'Invalid client_id' }, { status: 400 });
	}

	if (!body.result?.id || body.result?.platform !== 'google_search') {
		return json({ error: 'Invalid format. Must contain result.id and result.platform = "google_search".' }, { status: 400 });
	}

	const adsDir = path.join(CLIENTS_DIR, client_id, 'ads', 'google');
	let filename = `${body.result.id}.json`.replace(/[^a-z0-9-_.]/gi, '_').toLowerCase();
	const filePath = path.join(adsDir, filename);

	try {
		await fs.mkdir(adsDir, { recursive: true });
		await fs.writeFile(filePath, JSON.stringify(body, null, 4), 'utf-8');
		return json({ success: true, filename });
	} catch {
		return json({ success: false, error: 'Failed to save campaign' }, { status: 500 });
	}
};
