/**
 * Google Ads API — shared client factory.
 *
 * Bun auto-injects .env — no dotenv needed.
 * Re-exports enums and toMicros so scripts only need one import.
 *
 * Usage:
 *   import { ads, enums, micros, fromMicros } from './lib/ads.ts'
 *   const campaigns = await ads.portico.query(`SELECT ...`)
 */

import { GoogleAdsApi, enums, toMicros } from 'google-ads-api';

export { enums, toMicros };

const _client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
});

export const CLIENTS = {
  portico: 'CUSTOMER_ID_REDACTED',
} as const;

export type ClientName = keyof typeof CLIENTS;

/** Returns a configured Customer for any account ID. */
export function getCustomer(customerId: string) {
  const loginId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, '');
  return _client.Customer({
    customer_id: customerId.replace(/-/g, ''),
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
    ...(loginId ? { login_customer_id: loginId } : {}),
  });
}

/** Pre-built customers for known clients. */
export const ads = {
  portico: getCustomer(CLIENTS.portico),
} satisfies Record<ClientName, ReturnType<typeof getCustomer>>;

/** R$ → micros */
export const micros = (brl: number) => brl * 1_000_000;

/** micros → R$ */
export const fromMicros = (m: number | bigint) => Number(m) / 1_000_000;
