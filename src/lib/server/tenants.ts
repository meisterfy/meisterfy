import { getDb } from './db/index.ts';

export interface AdsMonitoringConfig {
	target_cpa_brl: number;
	no_conversion_alert_days: number;
	max_cpa_multiplier: number;
	min_daily_impressions: number;
	budget_underpace_threshold: number;
}

export interface Tenant {
	id: string;
	name: string;
	language: string;
	niche: string | null;
	location: string | null;
	primary_persona: string | null;
	tone: string | null;
	instructions: string | null;
	hashtags: string[];
	google_ads_id: string | null;
	ads_monitoring: AdsMonitoringConfig | null;
	created_at: string;
	updated_at: string;
}

interface TenantRow {
	id: string;
	name: string;
	language: string;
	niche: string | null;
	location: string | null;
	primary_persona: string | null;
	tone: string | null;
	instructions: string | null;
	hashtags: string | null;
	google_ads_id: string | null;
	ads_monitoring: string | null;
	created_at: string;
	updated_at: string;
}

function fromRow(row: TenantRow): Tenant {
	return {
		...row,
		hashtags: row.hashtags ? (JSON.parse(row.hashtags) as string[]) : [],
		ads_monitoring: row.ads_monitoring
			? (JSON.parse(row.ads_monitoring) as AdsMonitoringConfig)
			: null,
	};
}

export function listTenants(): Tenant[] {
	const rows = getDb().prepare('SELECT * FROM tenants ORDER BY name').all() as TenantRow[];
	return rows.map(fromRow);
}

export function getTenant(id: string): Tenant | null {
	const row = getDb().prepare('SELECT * FROM tenants WHERE id = ?').get(id) as TenantRow | null;
	return row ? fromRow(row) : null;
}

export function createTenant(data: Omit<Tenant, 'created_at' | 'updated_at'>): void {
	getDb()
		.prepare(
			`INSERT INTO tenants (id, name, language, niche, location, primary_persona, tone, instructions, hashtags, google_ads_id, ads_monitoring)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			data.id,
			data.name,
			data.language,
			data.niche ?? null,
			data.location ?? null,
			data.primary_persona ?? null,
			data.tone ?? null,
			data.instructions ?? null,
			data.hashtags.length ? JSON.stringify(data.hashtags) : null,
			data.google_ads_id ?? null,
			data.ads_monitoring ? JSON.stringify(data.ads_monitoring) : null
		);
}

export function updateTenant(
	id: string,
	data: Partial<Omit<Tenant, 'id' | 'created_at'>>
): void {
	const fields: string[] = [];
	const values: (string | number | null)[] = [];

	if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
	if (data.language !== undefined) { fields.push('language = ?'); values.push(data.language); }
	if (data.niche !== undefined) { fields.push('niche = ?'); values.push(data.niche); }
	if (data.location !== undefined) { fields.push('location = ?'); values.push(data.location); }
	if (data.primary_persona !== undefined) { fields.push('primary_persona = ?'); values.push(data.primary_persona); }
	if (data.tone !== undefined) { fields.push('tone = ?'); values.push(data.tone); }
	if (data.instructions !== undefined) { fields.push('instructions = ?'); values.push(data.instructions); }
	if (data.hashtags !== undefined) { fields.push('hashtags = ?'); values.push(JSON.stringify(data.hashtags)); }
	if (data.google_ads_id !== undefined) { fields.push('google_ads_id = ?'); values.push(data.google_ads_id); }
	if (data.ads_monitoring !== undefined) { fields.push('ads_monitoring = ?'); values.push(data.ads_monitoring ? JSON.stringify(data.ads_monitoring) : null); }

	if (fields.length === 0) return;
	fields.push("updated_at = datetime('now')");
	values.push(id);

	getDb().prepare(`UPDATE tenants SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteTenant(id: string): void {
	getDb().prepare('DELETE FROM tenants WHERE id = ?').run(id);
}
