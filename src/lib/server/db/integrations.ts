import { getDb } from './index';

export type IntegrationProvider = 'google_ads' | 'meta' | 'canva';
export type IntegrationStatus = 'pending' | 'connected' | 'error';

export interface Integration {
  id: string;
  name: string;
  provider: IntegrationProvider;
  oauth_client_id: string | null;
  oauth_client_secret: string | null;
  developer_token: string | null;
  login_customer_id: string | null;
  refresh_token: string | null;
  status: IntegrationStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationWithClients extends Integration {
  clients: string[];
}

export function listIntegrations(): IntegrationWithClients[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM integrations ORDER BY created_at').all() as Integration[];
  const allClients = db
    .prepare('SELECT integration_id, tenant_id FROM integration_clients')
    .all() as { integration_id: string; tenant_id: string }[];

  return rows.map((row) => ({
    ...row,
    clients: allClients.filter((c) => c.integration_id === row.id).map((c) => c.tenant_id),
  }));
}

export function getIntegration(id: string): IntegrationWithClients | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM integrations WHERE id = ?').get(id) as Integration | undefined;
  if (!row) return null;
  const clients = db
    .prepare('SELECT tenant_id FROM integration_clients WHERE integration_id = ?')
    .all(id) as { tenant_id: string }[];
  return { ...row, clients: clients.map((c) => c.tenant_id) };
}

export function getIntegrationForTenant(tenantId: string, provider: IntegrationProvider): Integration | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT i.* FROM integrations i
       JOIN integration_clients ic ON ic.integration_id = i.id
       WHERE ic.tenant_id = ? AND i.provider = ?
       LIMIT 1`,
    )
    .get(tenantId, provider) as Integration | undefined;
  return row ?? null;
}

export function createIntegration(data: Omit<Integration, 'created_at' | 'updated_at'>): void {
  getDb()
    .prepare(
      `INSERT INTO integrations
        (id, name, provider, oauth_client_id, oauth_client_secret, developer_token, login_customer_id, refresh_token, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.id,
      data.name,
      data.provider,
      data.oauth_client_id ?? null,
      data.oauth_client_secret ?? null,
      data.developer_token ?? null,
      data.login_customer_id ?? null,
      data.refresh_token ?? null,
      data.status,
      data.error_message ?? null,
    );
}

export function updateIntegration(
  id: string,
  data: Partial<Omit<Integration, 'id' | 'created_at' | 'updated_at'>>,
): void {
  const db = getDb();
  const entries = Object.entries(data);
  if (entries.length === 0) return;
  const fields = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = [...entries.map(([, v]) => v ?? null), new Date().toISOString(), id];
  db.prepare(`UPDATE integrations SET ${fields}, updated_at = ? WHERE id = ?`).run(...values);
}

export function deleteIntegration(id: string): void {
  getDb().prepare('DELETE FROM integrations WHERE id = ?').run(id);
}

export function setIntegrationClients(integrationId: string, tenantIds: string[]): void {
  const db = getDb();
  // Release tenants from other integrations before claiming them (replace semantics)
  for (const tenantId of tenantIds) {
    db.prepare(
      'DELETE FROM integration_clients WHERE tenant_id = ? AND integration_id != ?',
    ).run(tenantId, integrationId);
  }
  db.prepare('DELETE FROM integration_clients WHERE integration_id = ?').run(integrationId);
  for (const tenantId of tenantIds) {
    db.prepare(
      'INSERT OR IGNORE INTO integration_clients (integration_id, tenant_id) VALUES (?, ?)',
    ).run(integrationId, tenantId);
  }
}

export function getCredentialsForTenant(
  tenantId: string,
  provider: IntegrationProvider,
): {
  oauth_client_id: string;
  oauth_client_secret: string;
  developer_token: string;
  login_customer_id: string;
  refresh_token: string;
} | null {
  const integration = getIntegrationForTenant(tenantId, provider);
  if (
    !integration?.oauth_client_id ||
    !integration?.oauth_client_secret ||
    !integration?.developer_token ||
    !integration?.refresh_token
  ) {
    return null;
  }
  return {
    oauth_client_id: integration.oauth_client_id,
    oauth_client_secret: integration.oauth_client_secret,
    developer_token: integration.developer_token,
    login_customer_id: integration.login_customer_id ?? '',
    refresh_token: integration.refresh_token,
  };
}
