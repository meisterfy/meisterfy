<script lang="ts">
	import { TrendingUp } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'
	import type { DbHistoryDay } from '$lib/api/campaigns'
	import { brl } from '$lib/utils/format'

	let { history } = $props<{ history: DbHistoryDay[] }>()

	function getProjection(days: DbHistoryDay[]) {
		const currentYYYYMM = new Date().toISOString().substring(0, 7)
		const monthRows = days.filter((d) => d.date.startsWith(currentYYYYMM))
		const daysElapsed = monthRows.length
		if (daysElapsed === 0) return null

		const now = new Date()
		const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
		const currentSpend = monthRows.reduce((s, d) => s + d.cost, 0)
		const currentConversions = monthRows.reduce((s, d) => s + d.conversions, 0)
		const projectedSpend = (currentSpend / daysElapsed) * daysInMonth
		const projectedConversions = (currentConversions / daysElapsed) * daysInMonth
		const projectedCpa = projectedConversions > 0 ? projectedSpend / projectedConversions : null

		return { projectedSpend, projectedConversions, projectedCpa, daysElapsed }
	}

	const projection = $derived(getProjection(history))
</script>

{#if projection}
	<div
		class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
	>
		<div class="mb-6 flex items-center gap-2">
			<TrendingUp class="h-5 w-5 text-indigo-500" />
			<h3 class="text-lg font-bold text-slate-900 dark:text-white">
				{m['ads:analytics.projection_title']()}
			</h3>
		</div>
		<div class="grid grid-cols-3 gap-4">
			<div>
				<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
					{m['ads:analytics.projected_spend']()}
				</p>
				<p class="text-xl font-bold text-slate-900 dark:text-white">
					{brl(projection.projectedSpend)}
				</p>
			</div>
			<div>
				<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
					{m['ads:analytics.projected_conversions']()}
				</p>
				<p class="text-xl font-bold text-slate-900 dark:text-white">
					{projection.projectedConversions.toFixed(1)}
				</p>
			</div>
			<div>
				<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
					{m['ads:analytics.projected_cpa']()}
				</p>
				<p class="text-xl font-bold text-slate-900 dark:text-white">
					{projection.projectedCpa !== null ? brl(projection.projectedCpa) : '—'}
				</p>
			</div>
		</div>
		<p class="mt-3 text-xs text-slate-400">
			{m['ads:analytics.based_on_days']({ days: projection.daysElapsed })}
		</p>
	</div>
{/if}
