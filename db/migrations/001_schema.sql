-- Marketing CMS — Central Database Schema
-- Migration 001: Initial schema

CREATE TABLE IF NOT EXISTS daily_metrics (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant          TEXT    NOT NULL,
  campaign_id     TEXT    NOT NULL,
  date            TEXT    NOT NULL,  -- YYYY-MM-DD
  impressions     INTEGER NOT NULL DEFAULT 0,
  clicks          INTEGER NOT NULL DEFAULT 0,
  cost_micros     INTEGER NOT NULL DEFAULT 0,
  conversions     REAL    NOT NULL DEFAULT 0,
  budget_micros   INTEGER NOT NULL DEFAULT 0,
  campaign_status TEXT    NOT NULL DEFAULT '',
  serving_status  TEXT    NOT NULL DEFAULT '',
  ad_groups       TEXT    NOT NULL DEFAULT '[]',  -- JSON
  alerts          TEXT    NOT NULL DEFAULT '[]',  -- JSON
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant, campaign_id, date)
);

CREATE TABLE IF NOT EXISTS monthly_summary (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant            TEXT    NOT NULL,
  campaign_id       TEXT    NOT NULL,
  month             TEXT    NOT NULL,  -- YYYY-MM
  total_cost_micros INTEGER NOT NULL DEFAULT 0,
  total_conversions REAL    NOT NULL DEFAULT 0,
  total_clicks      INTEGER NOT NULL DEFAULT 0,
  total_impressions INTEGER NOT NULL DEFAULT 0,
  days_active       INTEGER NOT NULL DEFAULT 0,
  avg_cpa_micros    INTEGER NOT NULL DEFAULT 0,
  weekly_breakdown  TEXT    NOT NULL DEFAULT '[]',  -- JSON
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant, campaign_id, month)
);

CREATE TABLE IF NOT EXISTS alert_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant           TEXT    NOT NULL,
  campaign_id      TEXT    NOT NULL,
  date             TEXT    NOT NULL,
  level            TEXT    NOT NULL,  -- INFO | WARN | CRITICAL
  type             TEXT    NOT NULL,
  message          TEXT    NOT NULL,
  action_suggested TEXT,
  resolved         INTEGER NOT NULL DEFAULT 0,  -- 0=open 1=resolved 2=ignored
  resolved_at      TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  agent      TEXT NOT NULL,
  tenant     TEXT NOT NULL,
  date       TEXT NOT NULL,
  status     TEXT NOT NULL,  -- success | error
  output     TEXT,
  error      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_daily_tenant_campaign_date
  ON daily_metrics(tenant, campaign_id, date);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_resolved
  ON alert_events(tenant, resolved, date);

CREATE INDEX IF NOT EXISTS idx_monthly_tenant_campaign
  ON monthly_summary(tenant, campaign_id, month);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_tenant
  ON agent_runs(agent, tenant, date);
