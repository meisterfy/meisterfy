import { GoogleAdsApi, enums, toMicros } from 'google-ads-api';
import { getCredentialsForTenant } from '$lib/server/integrations';

export { enums, toMicros };

export const fromMicros = (m: number | bigint) => Number(m) / 1_000_000;
export const micros     = (brl: number) => brl * 1_000_000;

export type AdsCredentials = {
	oauth_client_id: string;
	oauth_client_secret: string;
	developer_token: string;
	login_customer_id: string;
	refresh_token: string;
};

export function resolveCreds(tenantId: string): AdsCredentials | null {
	const creds = getCredentialsForTenant(tenantId, 'google_ads');
	return creds ? (creds as AdsCredentials) : null;
}

export function getAdsCustomer(tenantId: string, customerId: string) {
	const creds = resolveCreds(tenantId);
	if (!creds) throw new Error(`No Google Ads credentials for tenant "${tenantId}"`);

	const client = new GoogleAdsApi({
		client_id:       creds.oauth_client_id,
		client_secret:   creds.oauth_client_secret,
		developer_token: creds.developer_token,
	});

	const loginId = creds.login_customer_id?.replace(/-/g, '');
	return client.Customer({
		customer_id:   customerId.replace(/-/g, ''),
		refresh_token: creds.refresh_token,
		...(loginId ? { login_customer_id: loginId } : {}),
	});
}
