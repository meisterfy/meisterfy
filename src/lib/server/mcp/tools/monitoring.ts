import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getTenant, type AdsMonitoringConfig } from '$lib/server/tenants.js'
import { getAdsCustomer, fromMicros } from '$lib/server/googleAdsClient.js'
import {
	upsertDailyMetrics,
	upsertMonthlySummary,
	getLastNDays,
	getMonthDays,
	getMonthlySummary,
	getCampaignsForTenant,
	type AdGroupMetrics,
	type AlertRecord,
} from '$db/monitoring.js'
import { insertAlert } from '$db/alerts.js'
import { logAgentRun } from '$db/agent-runs.js'

function ok(data: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}
function err(msg: string) {
	return { content: [{ type: 'text' as const, text: msg }], isError: true as const }
}

const MONITORING_DEFAULTS: AdsMonitoringConfig = {
	target_cpa_brl: 100,
	no_conversion_alert_days: 3,
	max_cpa_multiplier: 1.5,
	min_daily_impressions: 50,
	budget_underpace_threshold: 0.5,
}

export function registerMonitoringTools(server: McpServer): void {

	// ── collect_daily_metrics ─────────────────────────────────────────────────

	server.registerTool('collect_daily_metrics', {
		description: 'Fetch Google Ads metrics for a tenant from the API and store them in SQLite. Generates WARN/CRITICAL alerts automatically. Returns a summary of what was collected.',
		inputSchema: {
			tenant_id: z.string(),
			date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
				.describe('YYYY-MM-DD. Defaults to yesterday.'),
		},
	}, async ({ tenant_id, date }) => {
		const targetDate = date ?? (() => {
			const d = new Date()
			d.setDate(d.getDate() - 1)
			return d.toISOString().slice(0, 10)
		})()

		const tenant = getTenant(tenant_id)
		if (!tenant) return err(`Tenant "${tenant_id}" not found`)
		if (!tenant.google_ads_id) return err(`Tenant "${tenant_id}" has no google_ads_id`)

		const cfg: AdsMonitoringConfig = { ...MONITORING_DEFAULTS, ...(tenant.ads_monitoring ?? {}) }
		const customer = getAdsCustomer(tenant_id, tenant.google_ads_id)

		const summary: { campaign: string; cost: string; conversions: number; alerts: string[] }[] = []

		try {
			const campaignsRaw = await customer.query(`
				SELECT campaign.id, campaign.name, campaign.status,
				       campaign.serving_status, campaign_budget.amount_micros
				FROM campaign WHERE campaign.status != 'REMOVED'
			`)

			const metricsRaw = await customer.query(`
				SELECT campaign.id, metrics.impressions, metrics.clicks,
				       metrics.cost_micros, metrics.conversions
				FROM campaign
				WHERE campaign.status != 'REMOVED' AND segments.date = '${targetDate}'
			`)

			const metricsById = new Map(metricsRaw.map((r: any) => [String(r.campaign.id), r.metrics]))

			for (const camp of campaignsRaw as any[]) {
				const campaignId     = String(camp.campaign.id)
				const campaignName   = String(camp.campaign.name ?? campaignId)
				const budgetMicros   = Number(camp.campaign_budget?.amount_micros ?? 0)
				const campaignStatus = String(camp.campaign.status ?? 'UNKNOWN')
				const servingStatus  = String(camp.campaign.serving_status ?? 'UNKNOWN')

				const m           = metricsById.get(campaignId) as any
				const impressions = Number(m?.impressions ?? 0)
				const clicks      = Number(m?.clicks ?? 0)
				const costMicros  = Number(m?.cost_micros ?? 0)
				const conversions = Number(m?.conversions ?? 0)

				const adGroupsRaw = await customer.query(`
					SELECT ad_group.id, ad_group.name, ad_group.status,
					       metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
					FROM ad_group
					WHERE campaign.id = ${campaignId} AND segments.date = '${targetDate}'
				`)

				const adGroups: AdGroupMetrics[] = (adGroupsRaw as any[]).map(ag => ({
					id:          String(ag.ad_group.id),
					name:        String(ag.ad_group.name ?? ''),
					impressions: Number(ag.metrics.impressions ?? 0),
					clicks:      Number(ag.metrics.clicks ?? 0),
					conversions: Number(ag.metrics.conversions ?? 0),
					cost_micros: Number(ag.metrics.cost_micros ?? 0),
					status:      String(ag.ad_group.status ?? ''),
				}))

				const historyRaw = await customer.query(`
					SELECT segments.date, campaign.status, campaign.serving_status,
					       metrics.impressions, metrics.conversions
					FROM campaign
					WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_7_DAYS
					ORDER BY segments.date DESC
				`)

				const alerts: AlertRecord[] = []

				if (campaignStatus === 'ENABLED') {
					const activeDays = (historyRaw as any[]).filter(h =>
						String(h.campaign.status) === 'ENABLED' && Number(h.metrics.impressions) > 0
					)
					let streak = 0
					for (const day of activeDays) {
						if (Number(day.metrics.conversions) > 0) break
						streak++
					}
					if (streak >= cfg.no_conversion_alert_days) {
						alerts.push({
							level: streak >= cfg.no_conversion_alert_days * 2 ? 'CRITICAL' : 'WARN',
							type: 'no_conversions_streak',
							message: `${streak} days without conversion`,
							action_suggested: 'Review keywords, landing page and bid strategy',
						})
					}
					if (conversions > 0) {
						const cpaBrl = fromMicros(costMicros) / conversions
						if (cpaBrl > cfg.target_cpa_brl * cfg.max_cpa_multiplier) {
							const pct = ((cpaBrl / cfg.target_cpa_brl - 1) * 100).toFixed(0)
							alerts.push({
								level: 'WARN',
								type: 'high_cpa',
								message: `CPA R$${cpaBrl.toFixed(2)} — ${pct}% above target (R$${cfg.target_cpa_brl})`,
								action_suggested: 'Pause underperforming ad groups, review bids',
							})
						}
					}
					if (budgetMicros > 0 && impressions > 0) {
						const pace = costMicros / budgetMicros
						if (pace < cfg.budget_underpace_threshold) {
							alerts.push({
								level: 'INFO',
								type: 'budget_underpace',
								message: `Budget pacing ${(pace * 100).toFixed(0)}% (threshold ${(cfg.budget_underpace_threshold * 100).toFixed(0)}%)`,
								action_suggested: 'Check bids, quality score and targeting',
							})
						}
					}
					if (impressions > 0 && impressions < cfg.min_daily_impressions) {
						alerts.push({
							level: 'INFO',
							type: 'low_impressions',
							message: `${impressions} impressions — below minimum (${cfg.min_daily_impressions})`,
							action_suggested: 'Increase budget or bids, check impression share',
						})
					}
				}

				upsertDailyMetrics({
					tenant: tenant_id, campaign_id: campaignId, date: targetDate,
					impressions, clicks, cost_micros: costMicros, conversions,
					budget_micros: budgetMicros, campaign_status: campaignStatus,
					serving_status: servingStatus, ad_groups: adGroups, alerts,
				})

				for (const alert of alerts) {
					if (alert.level !== 'INFO') {
						insertAlert({ tenant: tenant_id, campaign_id: campaignId, date: targetDate, ...alert } as any)
					}
				}

				summary.push({
					campaign:    campaignName,
					cost:        `R$${fromMicros(costMicros).toFixed(2)}`,
					conversions,
					alerts:      alerts.filter(a => a.level !== 'INFO').map(a => `[${a.level}] ${a.type}`),
				})
			}

			logAgentRun({ agent: 'collect_daily_metrics', tenant: tenant_id, date: targetDate, status: 'success', output: JSON.stringify(summary) })
			return ok({ date: targetDate, campaigns_processed: summary.length, summary })

		} catch (e: any) {
			logAgentRun({ agent: 'collect_daily_metrics', tenant: tenant_id, date: targetDate, status: 'error', error: e.message })
			return err(e.message)
		}
	})

	// ── consolidate_monthly ───────────────────────────────────────────────────

	server.registerTool('consolidate_monthly', {
		description: 'Aggregate daily metrics stored in SQLite into a monthly summary for a tenant. Run after all daily metrics for the month have been collected.',
		inputSchema: {
			tenant_id: z.string(),
			month:     z.string().regex(/^\d{4}-\d{2}$/).optional()
				.describe('YYYY-MM. Defaults to previous calendar month.'),
		},
	}, async ({ tenant_id, month }) => {
		const targetMonth = month ?? (() => {
			const d = new Date()
			d.setDate(1)
			d.setMonth(d.getMonth() - 1)
			return d.toISOString().slice(0, 7)
		})()

		const tenant = getTenant(tenant_id)
		if (!tenant) return err(`Tenant "${tenant_id}" not found`)

		try {
			const campaigns = getCampaignsForTenant(tenant_id)
			if (campaigns.length === 0) return ok({ month: targetMonth, campaigns_processed: 0, message: 'No data found' })

			const results = []

			for (const { campaign_id } of campaigns) {
				const days = getMonthDays(tenant_id, campaign_id, targetMonth)
				if (days.length === 0) continue

				const totalCostMicros  = days.reduce((s, d) => s + d.cost_micros, 0)
				const totalConversions = days.reduce((s, d) => s + d.conversions, 0)
				const totalClicks      = days.reduce((s, d) => s + d.clicks, 0)
				const totalImpressions = days.reduce((s, d) => s + d.impressions, 0)
				const daysActive       = days.filter(d => d.impressions > 0).length
				const avgCpaMicros     = totalConversions > 0 ? Math.round(totalCostMicros / totalConversions) : 0

				const weekMap = new Map<string, { cost: number; conversions: number; clicks: number; impressions: number }>()
				for (const day of days) {
					const d = new Date(day.date)
					const ws = new Date(d)
					ws.setDate(d.getDate() - d.getDay())
					const key = ws.toISOString().slice(0, 10)
					const entry = weekMap.get(key) ?? { cost: 0, conversions: 0, clicks: 0, impressions: 0 }
					entry.cost        += day.cost_micros
					entry.conversions += day.conversions
					entry.clicks      += day.clicks
					entry.impressions += day.impressions
					weekMap.set(key, entry)
				}

				const weeklyBreakdown = Array.from(weekMap.entries())
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([week_start, w]) => ({
						week_start,
						cost_micros:  w.cost,
						conversions:  w.conversions,
						clicks:       w.clicks,
						impressions:  w.impressions,
						cpa_micros:   w.conversions > 0 ? Math.round(w.cost / w.conversions) : 0,
					}))

				upsertMonthlySummary(
					tenant_id, campaign_id, targetMonth,
					totalCostMicros, totalConversions, totalClicks, totalImpressions,
					daysActive, avgCpaMicros, weeklyBreakdown
				)

				results.push({
					campaign_id,
					cost:        `R$${(totalCostMicros / 1_000_000).toFixed(2)}`,
					conversions: totalConversions,
					clicks:      totalClicks,
					impressions: totalImpressions,
					days_active: daysActive,
					cpa:         totalConversions > 0 ? `R$${(totalCostMicros / 1_000_000 / totalConversions).toFixed(2)}` : 'N/A',
				})
			}

			logAgentRun({ agent: 'consolidate_monthly', tenant: tenant_id, date: targetMonth, status: 'success', output: JSON.stringify(results) })
			return ok({ month: targetMonth, campaigns_processed: results.length, results })

		} catch (e: any) {
			logAgentRun({ agent: 'consolidate_monthly', tenant: tenant_id, date: targetMonth, status: 'error', error: e.message })
			return err(e.message)
		}
	})

	// ── get_metrics_history ───────────────────────────────────────────────────

	server.registerTool('get_metrics_history', {
		description: 'Read stored daily metrics from SQLite for a campaign. Use this to analyse trends, build reports, or check recent performance without calling the Google Ads API.',
		inputSchema: {
			tenant_id:   z.string(),
			campaign_id: z.string(),
			days:        z.number().int().min(1).max(90).default(30),
		},
	}, async ({ tenant_id, campaign_id, days }) => {
		try {
			const rows = getLastNDays(tenant_id, campaign_id, days)
			return ok(rows.map(r => ({
				date:            r.date,
				impressions:     r.impressions,
				clicks:          r.clicks,
				cost:            `R$${(r.cost_micros / 1_000_000).toFixed(2)}`,
				conversions:     r.conversions,
				cpa:             r.conversions > 0 ? `R$${(r.cost_micros / 1_000_000 / r.conversions).toFixed(2)}` : null,
				campaign_status: r.campaign_status,
				ad_groups:       JSON.parse(r.ad_groups),
				alerts:          JSON.parse(r.alerts),
			})))
		} catch (e: any) {
			return err(e.message)
		}
	})

	// ── get_monthly_summary ───────────────────────────────────────────────────

	server.registerTool('get_monthly_summary', {
		description: 'Read a consolidated monthly summary from SQLite for a campaign. Includes weekly breakdown.',
		inputSchema: {
			tenant_id:   z.string(),
			campaign_id: z.string(),
			month:       z.string().regex(/^\d{4}-\d{2}$/).describe('YYYY-MM'),
		},
	}, async ({ tenant_id, campaign_id, month }) => {
		try {
			const row = getMonthlySummary(tenant_id, campaign_id, month)
			if (!row) return err(`No monthly summary for ${tenant_id}/${campaign_id}/${month}`)
			return ok({
				month:            row.month,
				campaign_id:      row.campaign_id,
				total_cost:       `R$${(row.total_cost_micros / 1_000_000).toFixed(2)}`,
				total_conversions: row.total_conversions,
				total_clicks:     row.total_clicks,
				total_impressions: row.total_impressions,
				days_active:      row.days_active,
				avg_cpa:          row.total_conversions > 0
					? `R$${(row.total_cost_micros / 1_000_000 / row.total_conversions).toFixed(2)}`
					: null,
				weekly_breakdown: JSON.parse(row.weekly_breakdown),
			})
		} catch (e: any) {
			return err(e.message)
		}
	})
}
