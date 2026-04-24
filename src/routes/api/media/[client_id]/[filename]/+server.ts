import fs from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const STORAGE_ROOT = path.resolve(process.cwd(), 'storage/images');

const mimeTypes: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm'
};

function isValidSegment(s: string): boolean {
	return s === path.basename(s) && /^[a-z0-9][a-z0-9-_.]*$/i.test(s);
}

export const GET: RequestHandler = async ({ params }) => {
	const { client_id, filename } = params;

	if (!isValidSegment(client_id) || !isValidSegment(filename)) {
		throw error(400, 'Invalid parameters');
	}

	const filePath = path.join(STORAGE_ROOT, client_id, filename);

	try {
		const ext = path.extname(filename).toLowerCase();
		const mimeType = mimeTypes[ext] || 'application/octet-stream';
		const data = await fs.readFile(filePath);

		return new Response(data, {
			headers: {
				'Content-Type': mimeType,
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch {
		throw error(404, 'Media not found');
	}
};
