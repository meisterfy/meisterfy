import fs from 'node:fs/promises';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CLIENTS_DIR = path.resolve('../clients');

function isValidSegment(s: string): boolean {
	return s === path.basename(s) && /^[a-z0-9][a-z0-9-_.]*$/i.test(s);
}

export const POST: RequestHandler = async ({ params, request }) => {
	const { client_id, filename } = params;

	if (!isValidSegment(client_id) || !isValidSegment(filename)) {
		return json({ error: 'Invalid parameters' }, { status: 400 });
	}

	const { status } = await request.json();
	const allowed = ['draft', 'approved', 'published'];
	if (!allowed.includes(status)) {
		return json({ error: 'Invalid status' }, { status: 400 });
	}

	const filePath = path.join(CLIENTS_DIR, client_id, 'ads', 'google', filename);

	try {
		const data = await fs.readFile(filePath, 'utf-8');
		const parsed = JSON.parse(data);
		if (parsed.result) {
			parsed.result.status = status;
			await fs.writeFile(filePath, JSON.stringify(parsed, null, 4), 'utf-8');
			return json({ success: true });
		}
		return json({ success: false, error: 'Invalid campaign format' }, { status: 400 });
	} catch {
		return json({ success: false, error: 'Campaign not found' }, { status: 404 });
	}
};
