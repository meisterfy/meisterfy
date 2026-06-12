<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import { ChartColumnIncreasing } from 'lucide-svelte'
	import type { AdGroup } from '$lib/api/campaigns'

	let { adGroups = [] } = $props<{ adGroups?: AdGroup[] }>()
</script>

<div
	class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
>
	<div
		class="border-b border-slate-200 bg-slate-50/50 px-6 py-5 dark:border-slate-800 dark:bg-slate-800/20"
	>
		<h3 class="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
			<ChartColumnIncreasing class="h-5 w-5 text-indigo-500" />
			{m['ads:ad_groups_breakdown']()}
		</h3>
	</div>
	<div class="overflow-x-auto">
		<table class="w-full text-left text-sm">
			<thead
				class="border-b border-slate-200 bg-slate-50 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
			>
				<tr>
					<th class="px-6 py-4">{m['ads:ad_groups']()}</th>
					<th class="px-6 py-4">{m['ads:status']()}</th>
					<th class="px-6 py-4 text-right">{m['ads:impressions']()}</th>
					<th class="px-6 py-4 text-right">{m['ads:clicks']()}</th>
					<th class="px-6 py-4 text-right">{m['ads:total_cost']()}</th>
					<th class="px-6 py-4 text-right">{m['ads:conversions']()}</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200 dark:divide-slate-800">
				{#each adGroups as group (group.name)}
					<tr class="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
						<td class="px-6 py-4 font-semibold text-slate-900 dark:text-white">
							{group.name}
						</td>
						<td class="px-6 py-4">
							<span
								class="rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase {group.status ===
								'ENABLED'
									? 'border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-400'
									: 'border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}"
							>
								{group.status}
							</span>
						</td>
						<td class="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-400">
							{group.metrics.impressions}
						</td>
						<td class="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-400">
							{group.metrics.clicks}
						</td>
						<td
							class="px-6 py-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400"
						>
							{group.metrics.cost}
						</td>
						<td class="px-6 py-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
							{group.metrics.conversions}
						</td>
					</tr>
				{/each}
				{#if adGroups.length === 0}
					<tr>
						<td colspan="6" class="px-6 py-8 text-center text-slate-500">
							{m['ads:messages.no_ad_groups_found']()}
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>
