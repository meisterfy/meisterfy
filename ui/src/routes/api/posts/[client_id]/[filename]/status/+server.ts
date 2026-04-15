import fs from 'node:fs/promises';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CLIENTS_DIR = path.resolve('../clients');

export const POST: RequestHandler = async ({ params, request }) => {
	const { status } = await request.json();
	const { client_id, filename } = params;

	const filePath = path.join(CLIENTS_DIR, client_id, 'posts', filename);

	try {
		const data = await fs.readFile(filePath, 'utf-8');
		const parsed = JSON.parse(data);

		if (parsed.result) {
			parsed.result.status = status;
			await fs.writeFile(filePath, JSON.stringify(parsed, null, 4), 'utf-8');
			return json({ success: true });
		}
		
		return json({ success: false, error: 'Invalid post format' }, { status: 400 });
	} catch (e) {
		return json({ success: false, error: 'Post not found' }, { status: 404 });
	}
};
