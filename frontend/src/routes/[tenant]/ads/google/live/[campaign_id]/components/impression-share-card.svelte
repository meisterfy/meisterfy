<script lang="ts">
	import type { ImpressionShareStats } from '$lib/api/campaigns'

	let { stats } = $props<{ stats: ImpressionShareStats | null }>()
</script>

{#if stats}
	<div class="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
		<h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
			Search Impression Share
		</h3>

		<div class="flex h-6 w-full overflow-hidden rounded-full">
			<div
				class="bg-emerald-500 transition-all"
				style="width: {(stats.wonShare * 100).toFixed(1)}%"
				title="Won"
			></div>
			<div
				class="bg-amber-400 transition-all"
				style="width: {(stats.lostBudget * 100).toFixed(1)}%"
				title="Lost to Budget"
			></div>
			<div
				class="bg-red-400 transition-all"
				style="width: {(stats.lostRank * 100).toFixed(1)}%"
				title="Lost to Rank"
			></div>
		</div>

		<div class="flex gap-6 text-sm">
			<div class="flex items-center gap-1.5">
				<span class="inline-block h-3 w-3 rounded-full bg-emerald-500"></span>
				<span class="text-slate-600 dark:text-slate-300">Won</span>
				<span class="font-semibold text-slate-800 dark:text-slate-100"
					>{(stats.wonShare * 100).toFixed(0)}%</span
				>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="inline-block h-3 w-3 rounded-full bg-amber-400"></span>
				<span class="text-slate-600 dark:text-slate-300">Lost to Budget</span>
				<span class="font-semibold text-slate-800 dark:text-slate-100"
					>{(stats.lostBudget * 100).toFixed(0)}%</span
				>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="inline-block h-3 w-3 rounded-full bg-red-400"></span>
				<span class="text-slate-600 dark:text-slate-300">Lost to Rank</span>
				<span class="font-semibold text-slate-800 dark:text-slate-100"
					>{(stats.lostRank * 100).toFixed(0)}%</span
				>
			</div>
		</div>

		{#if stats.lostBudget > 0.15}
			<div
				class="rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
			>
				Budget is limiting reach — consider increasing daily budget
			</div>
		{/if}
		{#if stats.lostRank > 0.15}
			<div
				class="rounded-lg border border-red-300/40 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300"
			>
				Rank is limiting reach — consider improving Quality Score or bids
			</div>
		{/if}
	</div>
{/if}
