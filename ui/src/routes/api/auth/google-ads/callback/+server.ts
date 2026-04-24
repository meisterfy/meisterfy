import { env } from '$env/dynamic/private';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';

const REFRESH_TOKEN_RE = /^[\w\-.]+$/;

function esc(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const GET: RequestHandler = async ({ url }) => {
	const code = url.searchParams.get('code');
	const oauthError = url.searchParams.get('error');

	if (oauthError || !code) {
		return html(`<h1>❌ Auth Error</h1><p>${esc(oauthError ?? 'No code received from Google.')}</p>`);
	}

	const clientId = env.GOOGLE_ADS_CLIENT_ID;
	const clientSecret = env.GOOGLE_ADS_CLIENT_SECRET;
	const redirectUri = `${url.origin}/api/auth/google-ads/callback`;

	const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code',
		}),
	});

	const tokens = await tokenRes.json() as { refresh_token?: string; error?: string; error_description?: string };

	if (!tokens.refresh_token) {
		const detail = tokens.error_description ?? tokens.error ?? 'unknown error';
		return html(`
			<h1>❌ No Refresh Token</h1>
			<p>Google did not return a refresh token (${esc(detail)}). If the account was already authorized, revoke access first at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> and try again.</p>
		`);
	}

	if (!REFRESH_TOKEN_RE.test(tokens.refresh_token)) {
		return html(`<h1>❌ Invalid Token Format</h1><p>Received an unexpected token format from Google. Aborting.</p>`);
	}

	const envPath = path.resolve('.env');
	let envContent = '';
	try {
		envContent = await fs.readFile(envPath, 'utf-8');
	} catch {
		// .env doesn't exist yet
	}

	if (envContent.includes('GOOGLE_ADS_REFRESH_TOKEN=')) {
		envContent = envContent.replace(/^GOOGLE_ADS_REFRESH_TOKEN=.*/m, `GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}`);
	} else {
		envContent = envContent.trimEnd() + `\nGOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}\n`;
	}

	await fs.writeFile(envPath, envContent, 'utf-8');

	return html(`
		<h1>✅ Authentication Successful</h1>
		<p>New refresh token saved to <code>.env</code>.</p>
		<p><strong>Restart the dev server</strong> (<code>bun run dev</code>) for the new token to take effect.</p>
		<p>You can close this tab now.</p>
	`);
};

function html(body: string): Response {
	return new Response(
		`<!doctype html><html><head><meta charset="utf-8"><title>Google Ads Auth</title>
		<style>body{font-family:sans-serif;max-width:640px;margin:60px auto;padding:20px;line-height:1.6}
		code{background:#f0f0f0;padding:2px 6px;border-radius:4px}</style>
		</head><body>${body}</body></html>`,
		{ headers: { 'content-type': 'text/html; charset=utf-8' } }
	);
}
