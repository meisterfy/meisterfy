<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity'
	import { m } from '$lib/paraglide/messages'
	import type { DbHistoryDay } from '$lib/api/campaigns'
	import { brl } from '$lib/utils/format'

	let { history } = $props<{ history: DbHistoryDay[] }>()

	interface MonthRow {
		month: string
		cost: number
		conversions: number
		clicks: number
		impressions: number
		cpa: number | null
		ctr: number | null
		activeDays: number
	}

	function groupByMonth(days: DbHistoryDay[]): MonthRow[] {
		const map = new SvelteMap<string, MonthRow>()
		for (const d of days) {
			const month = d.date.substring(0, 7)
			if (!map.has(month)) {
				map.set(month, {
					month,
					cost: 0,
					conversions: 0,
					clicks: 0,
					impressions: 0,
					cpa: null,
					ctr: null,
					activeDays: 0
				})
			}
			const row = map.get(month)!
			row.cost += d.cost
			row.conversions += d.conversions
			row.clicks += d.clicks
			row.impressions += d.impressions
			if (d.impressions > 0) row.activeDays++
		}
		const rows = Array.from(map.values())
		for (const r of rows) {
			r.cpa = r.conversions > 0 ? r.cost / r.conversions : null
			r.ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null
		}
		return rows.sort((a, b) => b.month.localeCompare(a.month))
	}

	function trend(
		cur: number | null,
		prev: number | null,
		lowerIsBetter = false
	): 'up' | 'down' | null {
		if (cur === null || prev === null || cur === prev) return null
		const improved = lowerIsBetter ? cur < prev : cur > prev
		return improved ? 'up' : 'down'
	}

	const rows = $derived(groupByMonth(history))
</script>

<div
	class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
>
	<h3 class="mb-6 text-lg font-bold text-slate-900 dark:text-white">
		{m['ads:analytics.monthly_title']()}
	</h3>
	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr
					class="border-b border-slate-100 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:border-slate-800"
				>
					<th class="pb-2 text-left">{m['ads:analytics.month']()}</th>
					<th class="pb-2 text-right">{m['ads:total_cost']()}</th>
					<th class="pb-2 text-right">{m['ads:conversions']()}</th>
					<th class="pb-2 text-right">{m['ads:cpa']()} △</th>
					<th class="pb-2 text-right">{m['ads:ctr']()}</th>
					<th class="pb-2 text-right">{m['ads:labels.active_days']()}</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row, i (row.month)}
					{@const prev = rows[i + 1]}
					{@const cpaTrend = prev ? trend(row.cpa, prev.cpa, true) : null}
					{@const convTrend = prev ? trend(row.conversions, prev.conversions) : null}
					<tr class="border-b border-slate-50 dark:border-slate-800/50">
						<td class="py-2 font-medium text-slate-700 dark:text-slate-300">{row.month}</td>
						<td class="py-2 text-right text-slate-700 dark:text-slate-300">{brl(row.cost)}</td>
						<td class="py-2 text-right text-slate-700 dark:text-slate-300">
							{row.conversions}
							{#if convTrend === 'up'}<span class="text-emerald-500">↑</span
								>{:else if convTrend === 'down'}<span class="text-red-500">↓</span>{/if}
						</td>
						<td class="py-2 text-right text-slate-700 dark:text-slate-300">
							{row.cpa !== null ? brl(row.cpa) : '—'}
							{#if cpaTrend === 'up'}<span class="text-emerald-500">↑</span
								>{:else if cpaTrend === 'down'}<span class="text-red-500">↓</span>{/if}
						</td>
						<td class="py-2 text-right text-slate-700 dark:text-slate-300">
							{row.ctr !== null ? row.ctr.toFixed(2) + '%' : '—'}
						</td>
						<td class="py-2 text-right text-slate-700 dark:text-slate-300">{row.activeDays}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
