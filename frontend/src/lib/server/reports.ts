import { getDb } from './db/index.ts';

export type ReportType = 'audit' | 'search' | 'weekly' | 'monthly' | 'alert' | 'report';

export interface Report {
	id: string;
	tenant_id: string;
	slug: string;
	type: ReportType;
	title: string | null;
	content: string;
	created_at: string;
}

export function detectReportType(slug: string): ReportType {
	if (slug.includes('audit')) return 'audit';
	if (slug.includes('search') || slug.includes('campaign')) return 'search';
	if (slug.includes('weekly')) return 'weekly';
	if (slug.includes('monthly') || /\d{4}-\d{2}$/.test(slug)) return 'monthly';
	if (slug.includes('alert')) return 'alert';
	return 'report';
}

export function listReports(tenantId: string): Report[] {
	return getDb()
		.prepare('SELECT * FROM reports WHERE tenant_id = ? ORDER BY created_at DESC')
		.all(tenantId) as Report[];
}

export function getReport(tenantId: string, slug: string): Report | null {
	return (
		(getDb()
			.prepare('SELECT * FROM reports WHERE tenant_id = ? AND slug = ?')
			.get(tenantId, slug) as Report | null) ?? null
	);
}

export function createReport(
	data: Omit<Report, 'id' | 'created_at'> & { id?: string }
): void {
	getDb()
		.prepare(
			`INSERT OR REPLACE INTO reports (id, tenant_id, slug, type, title, content)
       VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(
			data.id ?? crypto.randomUUID(),
			data.tenant_id,
			data.slug,
			data.type,
			data.title ?? null,
			data.content
		);
}

export function deleteReport(id: string): void {
	getDb().prepare('DELETE FROM reports WHERE id = ?').run(id);
}
