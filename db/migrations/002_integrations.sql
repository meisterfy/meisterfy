-- 002_integrations.sql

CREATE TABLE IF NOT EXISTS integrations (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  provider            TEXT NOT NULL,
  oauth_client_id     TEXT,
  oauth_client_secret TEXT,
  developer_token     TEXT,
  login_customer_id   TEXT,
  refresh_token       TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  error_message       TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS integration_clients (
  integration_id  TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  tenant_id       TEXT NOT NULL,
  PRIMARY KEY (integration_id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_clients_tenant
  ON integration_clients (tenant_id);
