import fs from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CLIENTS_DIR = path.resolve('../clients');

const mimeTypes: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm'
};

export const GET: RequestHandler = async ({ params }) => {
	const { client_id, filename } = params;
	const filePath = path.join(CLIENTS_DIR, client_id, 'posts', filename);

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
	} catch (e) {
		throw error(404, 'Media not found');
	}
};
