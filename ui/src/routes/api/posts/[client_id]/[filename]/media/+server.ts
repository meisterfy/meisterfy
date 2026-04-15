import fs from 'node:fs/promises';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CLIENTS_DIR = path.resolve('../clients');

export const POST: RequestHandler = async ({ params, request }) => {
	const { client_id, filename } = params;
	const prefix = filename.replace('.json', '');
	const postsDir = path.join(CLIENTS_DIR, client_id, 'posts');

	try {
		const formData = await request.formData();
		const files = formData.getAll('file') as File[];
		
		if (!files || files.length === 0) {
			return json({ success: false, error: 'No files provided' }, { status: 400 });
		}

		// Read old files to delete previous media
		const entries = await fs.readdir(postsDir);
		for (const entry of entries) {
			if (entry !== filename && (entry.startsWith(prefix + '.') || entry.startsWith(prefix + '-'))) {
				await fs.unlink(path.join(postsDir, entry)).catch(() => {});
			}
		}

		const newFilenames = [];

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const ext = path.extname(file.name) || '.jpg';
			
			// For multiple files, append -01, -02 etc. For a single file, just append the extension.
			let newFilename = `${prefix}${ext}`;
			if (files.length > 1) {
				const num = String(i + 1).padStart(2, '0');
				newFilename = `${prefix}-${num}${ext}`;
			}
			
			const filePath = path.join(postsDir, newFilename);
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			await fs.writeFile(filePath, buffer);
			
			newFilenames.push(newFilename);
		}

		return json({ success: true, media_files: newFilenames });
	} catch (e) {
		console.error('Failed to upload media:', e);
		return json({ success: false, error: 'Failed to upload media' }, { status: 500 });
	}
};
