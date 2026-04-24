/**
 * Monitoring domain — daily metrics and monthly summaries.
 * Handles both write (scripts) and read (UI / orchestrator).
 */

import { getDb } from './index';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AdGroupMetrics {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost_micros: number;
  status: string;
}

export interface AlertRecord {
  level: 'INFO' | 'WARN' | 'CRITICAL';
  type: string;
  message: string;
  action_suggested?: string;
}

export interface DailyMetricsInput {
  tenant: string;
  campaign_id: string;
  date: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  budget_micros: number;
  campaign_status: string;
  serving_status: string;
  ad_groups: AdGroupMetrics[];
  alerts: AlertRecord[];
}

export interface DailyMetricsRow {
  id: number;
  tenant: string;
  campaign_id: string;
  date: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  budget_micros: number;
  campaign_status: string;
  serving_status: string;
  ad_groups: string;  // JSON — parse when needed
  alerts: string;     // JSON — parse when needed
  created_at: string;
}

export interface WeeklyBreakdown {
  week_start: string;
  cost_micros: number;
  conversions: number;
  clicks: number;
  impressions: number;
  cpa_micros: number;
}

export interface MonthlySummaryRow {
  id: number;
  tenant: string;
  campaign_id: string;
  month: string;
  total_cost_micros: number;
  total_conversions: number;
  total_clicks: number;
  total_impressions: number;
  days_active: number;
  avg_cpa_micros: number;
  weekly_breakdown: string;  // JSON
  created_at: string;
}

// ── Write ──────────────────────────────────────────────────────────────────

export function upsertDailyMetrics(input: DailyMetricsInput): void {
  getDb().prepare(`
    INSERT INTO daily_metrics
      (tenant, campaign_id, date, impressions, clicks, cost_micros, conversions,
       budget_micros, campaign_status, serving_status, ad_groups, alerts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant, campaign_id, date) DO UPDATE SET
      impressions     = excluded.impressions,
      clicks          = excluded.clicks,
      cost_micros     = excluded.cost_micros,
      conversions     = excluded.conversions,
      budget_micros   = excluded.budget_micros,
      campaign_status = excluded.campaign_status,
      serving_status  = excluded.serving_status,
      ad_groups       = excluded.ad_groups,
      alerts          = excluded.alerts
  `).run(
    input.tenant, input.campaign_id, input.date,
    input.impressions, input.clicks, input.cost_micros, input.conversions,
    input.budget_micros, input.campaign_status, input.serving_status,
    JSON.stringify(input.ad_groups), JSON.stringify(input.alerts)
  );
}

export function upsertMonthlySummary(
  tenant: string,
  campaign_id: string,
  month: string,
  total_cost_micros: number,
  total_conversions: number,
  total_clicks: number,
  total_impressions: number,
  days_active: number,
  avg_cpa_micros: number,
  weekly_breakdown: WeeklyBreakdown[]
): void {
  getDb().prepare(`
    INSERT INTO monthly_summary
      (tenant, campaign_id, month, total_cost_micros, total_conversions,
       total_clicks, total_impressions, days_active, avg_cpa_micros, weekly_breakdown)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant, campaign_id, month) DO UPDATE SET
      total_cost_micros = excluded.total_cost_micros,
      total_conversions = excluded.total_conversions,
      total_clicks      = excluded.total_clicks,
      total_impressions = excluded.total_impressions,
      days_active       = excluded.days_active,
      avg_cpa_micros    = excluded.avg_cpa_micros,
      weekly_breakdown  = excluded.weekly_breakdown
  `).run(
    tenant, campaign_id, month,
    total_cost_micros, total_conversions, total_clicks, total_impressions,
    days_active, avg_cpa_micros, JSON.stringify(weekly_breakdown)
  );
}

// ── Read ───────────────────────────────────────────────────────────────────

export function getLastNDays(tenant: string, campaignId: string, days: number): DailyMetricsRow[] {
  return getDb().prepare(`
    SELECT * FROM daily_metrics
    WHERE tenant = ? AND campaign_id = ?
    ORDER BY date DESC
    LIMIT ?
  `).all(tenant, campaignId, days) as DailyMetricsRow[];
}

export function getMonthDays(tenant: string, campaignId: string, month: string): DailyMetricsRow[] {
  return getDb().prepare(`
    SELECT * FROM daily_metrics
    WHERE tenant = ? AND campaign_id = ? AND date LIKE ?
    ORDER BY date ASC
  `).all(tenant, campaignId, `${month}-%`) as DailyMetricsRow[];
}

export function getMonthlySummary(tenant: string, campaignId: string, month: string): MonthlySummaryRow | null {
  return getDb().prepare(`
    SELECT * FROM monthly_summary
    WHERE tenant = ? AND campaign_id = ? AND month = ?
  `).get(tenant, campaignId, month) as MonthlySummaryRow | null;
}

export function getCampaignsForTenant(tenant: string): { campaign_id: string }[] {
  return getDb().prepare(`
    SELECT DISTINCT campaign_id FROM daily_metrics
    WHERE tenant = ?
    ORDER BY campaign_id
  `).all(tenant) as { campaign_id: string }[];
}
