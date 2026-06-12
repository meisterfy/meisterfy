<script lang="ts">
	import { ChartColumnIncreasing } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'
	import type { DbHistoryDay } from '$lib/api/campaigns'
	import { createDailyCostCpaConfig } from '$lib/utils/charts'

	import PerformanceChart from '$lib/components/ads/performance-chart.svelte'
	import MonthlyMetricsGrid from '../components/monthly-metrics-grid.svelte'
	import SpendProjection from '../components/spend-projection.svelte'
	import MonthlyTable from '../components/monthly-table.svelte'
	import DayOfWeekChart from '../components/day-of-week-chart.svelte'
	import PerformanceExtremes from '../components/performance-extremes.svelte'

	let { dbHistory } = $props<{
		dbHistory: Promise<DbHistoryDay[]>
	}>()

	function getMonthlySummary(resHistory: DbHistoryDay[]) {
		const currentMonth = new Date().toISOString().substring(0, 7)
		const monthRows = resHistory.filter((d) => d.date.startsWith(currentMonth))
		if (monthRows.length === 0) return null

		const totalConv = monthRows.reduce((s, d) => s + d.conversions, 0)
		const totalCost = monthRows.reduce((s, d) => s + d.cost, 0)

		return {
			totalCost,
			totalConversions: totalConv,
			daysActive: monthRows.filter((d) => d.impressions > 0).length,
			avgCpa: totalConv > 0 ? totalCost / totalConv : 0
		}
	}
</script>

<div class="space-y-6 py-6">
	{#await dbHistory}
		<div class="animate-pulse space-y-4">
			<div class="h-24 rounded-xl bg-slate-50 dark:bg-slate-800/50"></div>
			<div class="h-64 rounded-xl bg-slate-100 dark:bg-slate-800"></div>
		</div>
	{:then resHistory}
		{#if resHistory.length > 0}
			<SpendProjection history={resHistory} />
			<MonthlyTable history={resHistory} />

			{@const monthly = getMonthlySummary(resHistory)}
			{#if monthly}
				<MonthlyMetricsGrid metrics={monthly} />
			{/if}

			<PerformanceChart
				config={createDailyCostCpaConfig(resHistory)}
				title={m['ads:graph.daily_cost_cpa']()}
				source={m['ads:graph.source']({ source: 'Local monitoring' })}
				note={m['ads:graph.cpa_only_on_days_with_conversions']()}
				icon={ChartColumnIncreasing}
			/>

			<DayOfWeekChart history={resHistory} />
			<PerformanceExtremes history={resHistory} />
		{/if}
	{/await}
</div>
