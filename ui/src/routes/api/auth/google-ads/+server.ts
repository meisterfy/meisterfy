import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const clientId = env.GOOGLE_ADS_CLIENT_ID;
	if (!clientId) {
		return new Response('GOOGLE_ADS_CLIENT_ID not set in .env', { status: 500 });
	}

	const redirectUri = `${url.origin}/api/auth/google-ads/callback`;

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'https://www.googleapis.com/auth/adwords',
		access_type: 'offline',
		prompt: 'consent',
	});

	redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};
