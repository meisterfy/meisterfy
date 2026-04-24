import { getDb } from './db/index.ts';

export interface Campaign {
	id: string;
	tenant_id: string;
	slug: string;
	data: Record<string, unknown>;
	deployed_at: string | null;
	created_at: string;
	updated_at: string;
}

interface CampaignRow {
	id: string;
	tenant_id: string;
	slug: string;
	data: string;
	deployed_at: string | null;
	created_at: string;
	updated_at: string;
}

function fromRow(row: CampaignRow): Campaign {
	return {
		...row,
		data: JSON.parse(row.data) as Record<string, unknown>,
	};
}

export function listCampaigns(tenantId: string): Campaign[] {
	const rows = getDb()
		.prepare('SELECT * FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC')
		.all(tenantId) as CampaignRow[];
	return rows.map(fromRow);
}

export function getCampaign(tenantId: string, slug: string): Campaign | null {
	const row = getDb()
		.prepare('SELECT * FROM campaigns WHERE tenant_id = ? AND slug = ?')
		.get(tenantId, slug) as CampaignRow | null;
	return row ? fromRow(row) : null;
}

export function upsertCampaign(
	tenantId: string,
	slug: string,
	data: Record<string, unknown>
): void {
	getDb()
		.prepare(
			`INSERT INTO campaigns (id, tenant_id, slug, data)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (tenant_id, slug) DO UPDATE SET
         data = excluded.data,
         updated_at = datetime('now')`
		)
		.run(crypto.randomUUID(), tenantId, slug, JSON.stringify(data));
}

export function markDeployed(id: string): void {
	getDb()
		.prepare("UPDATE campaigns SET deployed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
		.run(id);
}

export function deleteCampaign(id: string): void {
	getDb().prepare('DELETE FROM campaigns WHERE id = ?').run(id);
}
