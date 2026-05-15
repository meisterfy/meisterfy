<script lang="ts">
	import { Flame } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'
	import type { DbHistoryDay } from '$lib/api/campaigns'
	import { brl } from '$lib/utils/format'

	let { history } = $props<{ history: DbHistoryDay[] }>()

	function getExtremes(days: DbHistoryDay[]) {
		const withConversions = days.filter((d) => d.conversions > 0)
		if (withConversions.length < 10) return null

		const sorted = [...withConversions].sort((a, b) => a.cpa - b.cpa)
		const best = sorted.slice(0, 5)
		const worst = sorted.slice(-5).reverse()

		let maxStreak = 0
		let curStreak = 0
		for (const d of days) {
			if (d.conversions === 0) {
				curStreak++
				if (curStreak > maxStreak) maxStreak = curStreak
			} else {
				curStreak = 0
			}
		}

		return { best, worst, maxStreak }
	}

	function ddmm(date: string): string {
		return date.slice(8, 10) + '/' + date.slice(5, 7)
	}

	const extremes = $derived(getExtremes(history))
</script>

<div
	class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
>
	<div class="mb-6 flex items-center gap-2">
		<Flame class="h-5 w-5 text-indigo-500" />
		<h3 class="text-lg font-bold text-slate-900 dark:text-white">
			{m['ads:analytics.extremes_title']()}
		</h3>
	</div>

	{#if !extremes}
		<p class="py-4 text-center text-sm text-slate-400">{m['ads:analytics.no_conversion_data']()}</p>
	{:else}
		<div class="mb-6 grid grid-cols-2 gap-6">
			<div>
				<p class="mb-3 text-xs font-semibold tracking-wide text-emerald-600 uppercase">
					{m['ads:analytics.best_days']()}
				</p>
				{#each extremes.best as d}
					<div
						class="flex justify-between border-b border-slate-50 py-1.5 text-sm dark:border-slate-800"
					>
						<span class="text-slate-500">{ddmm(d.date)}</span>
						<span class="font-medium text-slate-700 dark:text-slate-300">{brl(d.cpa)}</span>
						<span class="text-slate-400">{d.conversions} conv.</span>
					</div>
				{/each}
			</div>
			<div>
				<p class="mb-3 text-xs font-semibold tracking-wide text-red-500 uppercase">
					{m['ads:analytics.worst_days']()}
				</p>
				{#each extremes.worst as d}
					<div
						class="flex justify-between border-b border-slate-50 py-1.5 text-sm dark:border-slate-800"
					>
						<span class="text-slate-500">{ddmm(d.date)}</span>
						<span class="font-medium text-slate-700 dark:text-slate-300">{brl(d.cpa)}</span>
						<span class="text-slate-400">{d.conversions} conv.</span>
					</div>
				{/each}
			</div>
		</div>
		{#if extremes.maxStreak > 0}
			<p class="text-center text-xs text-slate-400">
				{m['ads:analytics.dry_streak']({ days: extremes.maxStreak })}
			</p>
		{/if}
	{/if}
</div>
