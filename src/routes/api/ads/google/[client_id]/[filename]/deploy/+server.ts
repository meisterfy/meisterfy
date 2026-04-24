import { json } from '@sveltejs/kit';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import type { RequestHandler } from './$types';

function isValidSegment(s: string): boolean {
	return s === path.basename(s) && /^[a-z0-9][a-z0-9-_.]*$/i.test(s);
}

export const POST: RequestHandler = async ({ params }) => {
	const { client_id, filename } = params;

	if (!isValidSegment(client_id) || !isValidSegment(filename)) {
		return json({ error: 'Invalid parameters' }, { status: 400 });
	}

	const campaignPath = path.resolve(`../clients/${client_id}/ads/google/${filename}`);
	const scriptPath = path.resolve('../scripts/deploy-google-ads.ts');

	const result = spawnSync('bun', ['run', scriptPath, campaignPath], {
		cwd: path.resolve('..'),
		encoding: 'utf-8',
		timeout: 90_000,
		env: process.env,
	});

	if (result.status !== 0) {
		const errorMsg = result.stderr?.trim() || result.stdout?.trim() || 'Deploy failed with no output.';
		return json({ success: false, error: errorMsg }, { status: 500 });
	}

	return json({ success: true, output: result.stdout?.trim() });
};
