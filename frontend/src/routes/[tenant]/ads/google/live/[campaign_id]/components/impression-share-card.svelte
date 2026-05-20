<script lang="ts">
	import type { ImpressionShareStats } from '$lib/api/campaigns'
	import { m } from '$lib/paraglide/messages'

	let { stats } = $props<{ stats: ImpressionShareStats | null }>()
</script>

{#if stats}
	<div class="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
		<h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
			{m['ads:analytics.impression_share_title']()}
		</h3>

		<div class="flex h-6 w-full overflow-hidden rounded-full">
			<div
				class="bg-emerald-500 transition-all"
				style="width: {(stats.wonShare * 100).toFixed(1)}%"
				title={m['ads:analytics.impression_share_won']()}
			></div>
			<div
				class="bg-amber-400 transition-all"
				style="width: {(stats.lostBudget * 100).toFixed(1)}%"
				title={m['ads:analytics.impression_share_lost_budget']()}
			></div>
			<div
				class="bg-red-400 transition-all"
				style="width: {(stats.lostRank * 100).toFixed(1)}%"
				title={m['ads:analytics.impression_share_lost_rank']()}
			></div>
		</div>

		<div class="flex gap-6 text-sm">
			<div class="flex items-center gap-1.5">
				<span class="inline-block h-3 w-3 rounded-full bg-emerald-500"></span>
				<span class="text-slate-600 dark:text-slate-300">{m['ads:analytics.impression_share_won']()}</span>
				<span class="font-semibold text-slate-800 dark:text-slate-100"
					>{(stats.wonShare * 100).toFixed(0)}%</span
				>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="inline-block h-3 w-3 rounded-full bg-amber-400"></span>
				<span class="text-slate-600 dark:text-slate-300">{m['ads:analytics.impression_share_lost_budget']()}</span>
				<span class="font-semibold text-slate-800 dark:text-slate-100"
					>{(stats.lostBudget * 100).toFixed(0)}%</span
				>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="inline-block h-3 w-3 rounded-full bg-red-400"></span>
				<span class="text-slate-600 dark:text-slate-300">{m['ads:analytics.impression_share_lost_rank']()}</span>
				<span class="font-semibold text-slate-800 dark:text-slate-100"
					>{(stats.lostRank * 100).toFixed(0)}%</span
				>
			</div>
		</div>

		{#if stats.lostBudget > 0.15}
			<div
				class="rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
			>
				{m['ads:analytics.impression_share_budget_warning']()}
			</div>
		{/if}
		{#if stats.lostRank > 0.15}
			<div
				class="rounded-lg border border-red-300/40 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300"
			>
				{m['ads:analytics.impression_share_rank_warning']()}
			</div>
		{/if}
	</div>
{/if}
