/**
 * Consolidate daily metrics into a monthly summary.
 *
 * Usage:
 *   bun run scripts/consolidate-monthly.ts <tenant> [YYYY-MM]
 *
 * If month is omitted, defaults to the previous calendar month.
 * Typically scheduled for the 1st of each month.
 */

import { getMonthDays, getCampaignsForTenant, upsertMonthlySummary, type WeeklyBreakdown } from '../src/lib/server/db/monitoring.ts';
import { logAgentRun } from '../src/lib/server/db/agent-runs.ts';

// ── Args ───────────────────────────────────────────────────────────────────

const [tenant, monthArg] = process.argv.slice(2);
if (!tenant) {
  console.error('Usage: bun run scripts/consolidate-monthly.ts <tenant> [YYYY-MM]');
  process.exit(1);
}

const month = monthArg ?? (() => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
})();

// ── Consolidation ──────────────────────────────────────────────────────────

console.log(`[${tenant}] Consolidating ${month}...`);

const output: string[] = [];

try {
  const campaigns = getCampaignsForTenant(tenant);

  if (campaigns.length === 0) {
    console.log(`No data found for ${tenant}.`);
    process.exit(0);
  }

  for (const { campaign_id } of campaigns) {
    const days = getMonthDays(tenant, campaign_id, month);
    if (days.length === 0) continue;

    const totalCostMicros   = days.reduce((s, d) => s + d.cost_micros, 0);
    const totalConversions  = days.reduce((s, d) => s + d.conversions, 0);
    const totalClicks       = days.reduce((s, d) => s + d.clicks, 0);
    const totalImpressions  = days.reduce((s, d) => s + d.impressions, 0);
    const daysActive        = days.filter(d => d.impressions > 0).length;
    const avgCpaMicros      = totalConversions > 0
      ? Math.round(totalCostMicros / totalConversions)
      : 0;

    // Weekly breakdown (Sun–Sat buckets)
    const weekMap = new Map<string, { cost: number; conversions: number; clicks: number; impressions: number }>();
    for (const day of days) {
      const d = new Date(day.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      const entry = weekMap.get(key) ?? { cost: 0, conversions: 0, clicks: 0, impressions: 0 };
      entry.cost        += day.cost_micros;
      entry.conversions += day.conversions;
      entry.clicks      += day.clicks;
      entry.impressions += day.impressions;
      weekMap.set(key, entry);
    }

    const weeklyBreakdown: WeeklyBreakdown[] = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week_start, w]) => ({
        week_start,
        cost_micros:  w.cost,
        conversions:  w.conversions,
        clicks:       w.clicks,
        impressions:  w.impressions,
        cpa_micros:   w.conversions > 0 ? Math.round(w.cost / w.conversions) : 0,
      }));

    upsertMonthlySummary(
      tenant, campaign_id, month,
      totalCostMicros, totalConversions, totalClicks, totalImpressions,
      daysActive, avgCpaMicros, weeklyBreakdown
    );

    const costBrl = totalCostMicros / 1_000_000;
    const cpaBrl  = totalConversions > 0 ? `R$${(costBrl / totalConversions).toFixed(2)}` : 'N/A';
    const line    = `  Campaign ${campaign_id}: R$${costBrl.toFixed(2)} | conv: ${totalConversions} | CPA: ${cpaBrl} | ${daysActive} dias ativos`;

    output.push(line);
    console.log(line);
  }

  logAgentRun({ agent: 'consolidate-monthly', tenant, date: month, status: 'success', output: output.join('\n') });
  console.log(`\n[${tenant}] Done.`);

} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  logAgentRun({ agent: 'consolidate-monthly', tenant, date: month, status: 'error', error: msg });
  console.error(`[error] ${msg}`);
  process.exit(1);
}
