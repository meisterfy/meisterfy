/**
 * Alerts domain — WARN and CRITICAL events that surface in the UI inbox.
 * INFO alerts are stored only in daily_metrics.alerts JSON, not here.
 */

import { getDb } from './index';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AlertEventInput {
  tenant: string;
  campaign_id: string;
  date: string;
  level: 'WARN' | 'CRITICAL';
  type: string;
  message: string;
  action_suggested?: string;
}

export interface AlertEventRow extends AlertEventInput {
  id: number;
  resolved: number;  // 0=open 1=resolved 2=ignored
  resolved_at: string | null;
  created_at: string;
}

// ── Write ──────────────────────────────────────────────────────────────────

export function insertAlert(alert: AlertEventInput): void {
  getDb().prepare(`
    INSERT INTO alert_events (tenant, campaign_id, date, level, type, message, action_suggested)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    alert.tenant, alert.campaign_id, alert.date,
    alert.level, alert.type, alert.message,
    alert.action_suggested ?? null
  );
}

export function resolveAlert(id: number, action: 'resolved' | 'ignored'): void {
  getDb().prepare(`
    UPDATE alert_events
    SET resolved = ?, resolved_at = datetime('now')
    WHERE id = ?
  `).run(action === 'resolved' ? 1 : 2, id);
}

// ── Read ───────────────────────────────────────────────────────────────────

export function getOpenAlerts(tenant: string): AlertEventRow[] {
  return getDb().prepare(`
    SELECT * FROM alert_events
    WHERE tenant = ? AND resolved = 0
    ORDER BY CASE level WHEN 'CRITICAL' THEN 0 WHEN 'WARN' THEN 1 ELSE 2 END,
             date DESC
  `).all(tenant) as AlertEventRow[];
}

export function getAllOpenAlerts(): AlertEventRow[] {
  return getDb().prepare(`
    SELECT * FROM alert_events
    WHERE resolved = 0
    ORDER BY CASE level WHEN 'CRITICAL' THEN 0 WHEN 'WARN' THEN 1 ELSE 2 END,
             date DESC
  `).all() as AlertEventRow[];
}

export function getAlertHistory(tenant: string, limit = 30): AlertEventRow[] {
  return getDb().prepare(`
    SELECT * FROM alert_events
    WHERE tenant = ?
    ORDER BY date DESC, created_at DESC
    LIMIT ?
  `).all(tenant, limit) as AlertEventRow[];
}
