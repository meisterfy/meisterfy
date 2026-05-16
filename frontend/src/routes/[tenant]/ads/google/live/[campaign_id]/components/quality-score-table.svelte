<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import type { KeywordQSRow } from '$lib/api/campaigns'

	let { keywords } = $props<{ keywords: KeywordQSRow[] }>()

	const sorted = $derived([...keywords].sort((a, b) => a.qualityScore - b.qualityScore))
	const lowQsCount = $derived(
		keywords.filter((k: KeywordQSRow) => k.qualityScore > 0 && k.qualityScore < 5).length
	)

	function qsBadge(qs: number) {
		if (qs === 0)
			return {
				label: m['ads:analytics.quality_score_qs_na'](),
				cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
			}
		if (qs <= 4)
			return {
				label: m['ads:analytics.quality_score_qs_poor'](),
				cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
			}
		if (qs <= 7)
			return {
				label: m['ads:analytics.quality_score_qs_ok'](),
				cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
			}
		return {
			label: m['ads:analytics.quality_score_qs_good'](),
			cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
		}
	}

	function signalDot(value: string) {
		if (value === 'BELOW_AVERAGE') return 'bg-red-500'
		if (value === 'ABOVE_AVERAGE') return 'bg-green-500'
		if (value === 'AVERAGE') return 'bg-amber-400'
		return 'bg-slate-300 dark:bg-slate-600'
	}

	function matchTypeLabel(mt: string) {
		if (mt === 'BROAD') return 'Broad'
		if (mt === 'PHRASE') return 'Phrase'
		if (mt === 'EXACT') return 'Exact'
		return mt
	}
</script>

<div class="space-y-3 rounded-xl border border-white/10 bg-white p-4 dark:bg-slate-900">
	<h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
		{m['ads:analytics.quality_score_title']()}
	</h3>

	{#if keywords.length === 0}
		<p class="text-sm text-slate-400">{m['ads:analytics.quality_score_empty']()}</p>
	{:else}
		{#if lowQsCount > 0}
			<p class="text-xs font-medium text-red-600 dark:text-red-400">
				{m['ads:analytics.quality_score_action_needed']({ count: lowQsCount })}
			</p>
		{/if}

		<div class="overflow-x-auto">
			<table class="w-full text-xs">
				<thead>
					<tr class="border-b border-white/10 text-left text-slate-500">
						<th class="pr-3 pb-1 font-medium">Keyword</th>
						<th class="pr-3 pb-1 font-medium">Match</th>
						<th class="pr-3 pb-1 font-medium">Ad Group</th>
						<th class="pr-3 pb-1 text-center font-medium">QS</th>
						<th class="pr-3 pb-1 text-center font-medium">Creative</th>
						<th class="pr-3 pb-1 text-center font-medium">Landing Page</th>
						<th class="pb-1 text-center font-medium">Pred. CTR</th>
					</tr>
				</thead>
				<tbody>
					{#each sorted as kw (kw.keywordText)}
						{@const badge = qsBadge(kw.qualityScore)}
						<tr class="border-b border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
							<td class="max-w-[180px] truncate py-1.5 pr-3 text-slate-700 dark:text-slate-200"
								>{kw.keywordText}</td
							>
							<td class="py-1.5 pr-3 text-slate-500">{matchTypeLabel(kw.matchType)}</td>
							<td class="max-w-[120px] truncate py-1.5 pr-3 text-slate-500">{kw.adGroupName}</td>
							<td class="py-1.5 pr-3 text-center">
								<span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold {badge.cls}">
									{kw.qualityScore > 0 ? kw.qualityScore : ''}{kw.qualityScore > 0
										? ' · '
										: ''}{badge.label}
								</span>
							</td>
							<td class="py-1.5 pr-3 text-center">
								<span class="inline-block h-2 w-2 rounded-full {signalDot(kw.creativeQS)}"></span>
							</td>
							<td class="py-1.5 pr-3 text-center">
								<span class="inline-block h-2 w-2 rounded-full {signalDot(kw.postClickQS)}"></span>
							</td>
							<td class="py-1.5 text-center">
								<span class="inline-block h-2 w-2 rounded-full {signalDot(kw.predictedCTR)}"></span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
