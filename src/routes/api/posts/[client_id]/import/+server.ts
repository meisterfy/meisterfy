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

	const postsDir = path.join(CLIENTS_DIR, client_id, 'posts');

	try {
		if (!body.result || !body.result.id) {
			return json({ success: false, error: 'Invalid format. Missing result.id' }, { status: 400 });
		}

		let filename = `${body.result.id}.json`;
		// Ensure safe filename
		filename = filename.replace(/[^a-z0-9-_.]/gi, '_').toLowerCase();

		const filePath = path.join(postsDir, filename);

		// ensure directory exists
		await fs.mkdir(postsDir, { recursive: true });
		
		// Write the file
		await fs.writeFile(filePath, JSON.stringify(body, null, 4), 'utf-8');

		return json({ success: true, filename });
	} catch (e) {
		return json({ success: false, error: 'Failed to import JSON' }, { status: 500 });
	}
};
