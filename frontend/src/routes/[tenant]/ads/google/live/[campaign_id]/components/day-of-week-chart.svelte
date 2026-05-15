<script lang="ts">
	import { Chart, registerables } from 'chart.js'
	import { BarChart2 } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'
	import type { DbHistoryDay } from '$lib/api/campaigns'
	import { createDayOfWeekCostConfig, createDayOfWeekCpaConfig } from '$lib/utils/charts'

	Chart.register(...registerables)

	let { history } = $props<{ history: DbHistoryDay[] }>()

	function aggregateByDow(days: DbHistoryDay[]) {
		const totals = Array.from({ length: 7 }, () => ({
			cost: 0,
			conversions: 0,
			impressions: 0,
			days: 0,
		}))
		for (const d of days) {
			if (d.impressions > 0) {
				const dow = new Date(d.date + 'T12:00:00').getDay()
				totals[dow].cost += d.cost
				totals[dow].conversions += d.conversions
				totals[dow].impressions += d.impressions
				totals[dow].days++
			}
		}
		return {
			avgCosts: totals.map((t) => (t.days > 0 ? t.cost / t.days : 0)),
			avgCpas: totals.map((t) =>
				t.conversions > 0 ? t.cost / t.conversions : null,
			) as (number | null)[],
		}
	}

	const hasEnoughData = $derived(history.length >= 14)
	const agg = $derived(aggregateByDow(history))
	const costConfig = $derived(createDayOfWeekCostConfig(agg.avgCosts))
	const cpaConfig = $derived(createDayOfWeekCpaConfig(agg.avgCpas))

	let costCanvas = $state<HTMLCanvasElement | undefined>()
	let cpaCanvas = $state<HTMLCanvasElement | undefined>()
	let costInstance: Chart | null = null
	let cpaInstance: Chart | null = null

	$effect(() => {
		if (!costCanvas) return
		costInstance?.destroy()
		costInstance = new Chart(costCanvas, costConfig)
		return () => {
			costInstance?.destroy()
			costInstance = null
		}
	})

	$effect(() => {
		if (!cpaCanvas) return
		cpaInstance?.destroy()
		cpaInstance = new Chart(cpaCanvas, cpaConfig)
		return () => {
			cpaInstance?.destroy()
			cpaInstance = null
		}
	})
</script>

<div
	class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
>
	<div class="mb-1 flex items-center gap-2">
		<BarChart2 class="h-5 w-5 text-indigo-500" />
		<h3 class="text-lg font-bold text-slate-900 dark:text-white">
			{m['ads:analytics.dow_title']()}
		</h3>
	</div>
	<p class="mb-6 ml-7 text-xs text-slate-400">{m['ads:analytics.dow_subtitle']()}</p>

	{#if !hasEnoughData}
		<p class="py-8 text-center text-sm text-slate-400">{m['ads:analytics.dow_min_data']()}</p>
	{:else}
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<div>
				<p class="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
					{m['ads:analytics.dow_avg_cost']()}
				</p>
				<div class="h-[220px] w-full">
					<canvas bind:this={costCanvas}></canvas>
				</div>
			</div>
			<div>
				<p class="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
					{m['ads:analytics.dow_avg_cpa']()}
				</p>
				<div class="h-[220px] w-full">
					<canvas bind:this={cpaCanvas}></canvas>
				</div>
			</div>
		</div>
	{/if}
</div>
