<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import { brl } from '$lib/utils/format'
	import type { KeywordPerfRow } from '$lib/api/campaigns'

	let { keywords } = $props<{ keywords: KeywordPerfRow[] }>()

	type SortKey = keyof KeywordPerfRow
	let sortKey = $state<SortKey>('cost')
	let sortAsc = $state(false)
	let filter = $state('')

	const filtered = $derived(
		filter.trim()
			? keywords.filter((k: KeywordPerfRow) =>
					k.keywordText.toLowerCase().includes(filter.toLowerCase())
				)
			: keywords
	)

	const sorted = $derived(
		[...filtered].sort((a, b) => {
			const av = a[sortKey]
			const bv = b[sortKey]
			if (typeof av === 'number' && typeof bv === 'number') {
				return sortAsc ? av - bv : bv - av
			}
			return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
		})
	)

	function setSort(key: SortKey) {
		if (sortKey === key) {
			sortAsc = !sortAsc
		} else {
			sortKey = key
			sortAsc = false
		}
	}

	function sortIcon(key: SortKey) {
		if (sortKey !== key) return ''
		return sortAsc ? ' ↑' : ' ↓'
	}

	function matchBadge(mt: string) {
		if (mt === 'BROAD') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
		if (mt === 'PHRASE') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
		if (mt === 'EXACT')
			return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
		return 'bg-slate-100 text-slate-500'
	}

	function matchLabel(mt: string) {
		if (mt === 'BROAD') return m['ads:analytics.match_broad']()
		if (mt === 'PHRASE') return m['ads:analytics.match_phrase']()
		if (mt === 'EXACT') return m['ads:analytics.match_exact']()
		return mt
	}
</script>

<div class="space-y-3 rounded-xl border border-white/10 bg-white p-4 dark:bg-slate-900">
	<div class="flex items-center justify-between gap-3">
		<h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
			{m['ads:analytics.keywords_title']()}
		</h3>
		<input
			type="text"
			bind:value={filter}
			placeholder={m['ads:analytics.keywords_filter_placeholder']()}
			class="w-48 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 placeholder-slate-400 focus:ring-1 focus:ring-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:placeholder-slate-500"
		/>
	</div>

	{#if keywords.length === 0}
		<p class="text-sm text-slate-400">{m['ads:analytics.keywords_empty']()}</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-xs">
				<thead>
					<tr class="border-b border-white/10 text-left text-slate-500">
						<th
							class="cursor-pointer pr-3 pb-1 font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
							onclick={() => setSort('keywordText')}>{m['ads:analytics.kw_keyword']()}{sortIcon('keywordText')}</th
						>
						<th class="pr-3 pb-1 font-medium">{m['ads:analytics.kw_match']()}</th>
						<th class="pr-3 pb-1 font-medium">{m['ads:analytics.kw_adgroup']()}</th>
						<th
							class="cursor-pointer pr-3 pb-1 text-right font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
							onclick={() => setSort('clicks')}>{m['ads:clicks']()}{sortIcon('clicks')}</th
						>
						<th
							class="cursor-pointer pr-3 pb-1 text-right font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
							onclick={() => setSort('impressions')}>{m['ads:analytics.kw_impr']()}{sortIcon('impressions')}</th
						>
						<th
							class="cursor-pointer pr-3 pb-1 text-right font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
							onclick={() => setSort('cost')}>{m['ads:analytics.kw_cost']()}{sortIcon('cost')}</th
						>
						<th
							class="cursor-pointer pr-3 pb-1 text-right font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
							onclick={() => setSort('conversions')}>{m['ads:analytics.kw_conv']()}{sortIcon('conversions')}</th
						>
						<th
							class="cursor-pointer pr-3 pb-1 text-right font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
							onclick={() => setSort('cpa')}>{m['ads:cpa']()}{sortIcon('cpa')}</th
						>
						<th
							class="cursor-pointer pb-1 text-right font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
							onclick={() => setSort('ctr')}>{m['ads:ctr']()}{sortIcon('ctr')}</th
						>
					</tr>
				</thead>
				<tbody>
					{#each sorted as kw (`${kw.keywordText}|${kw.matchType}|${kw.adGroupName}`)}
						<tr class="border-b border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
							<td class="max-w-[180px] truncate py-1.5 pr-3 text-slate-700 dark:text-slate-200"
								>{kw.keywordText}</td
							>
							<td class="py-1.5 pr-3">
								<span
									class="rounded-full px-1.5 py-0.5 text-[10px] font-medium {matchBadge(
										kw.matchType
									)}">{matchLabel(kw.matchType)}</span
								>
							</td>
							<td class="max-w-[120px] truncate py-1.5 pr-3 text-slate-500">{kw.adGroupName}</td>
							<td class="py-1.5 pr-3 text-right tabular-nums">{kw.clicks}</td>
							<td class="py-1.5 pr-3 text-right tabular-nums">{kw.impressions}</td>
							<td class="py-1.5 pr-3 text-right tabular-nums">{brl(kw.cost)}</td>
							<td class="py-1.5 pr-3 text-right tabular-nums">{kw.conversions}</td>
							<td class="py-1.5 pr-3 text-right tabular-nums">{kw.cpa > 0 ? brl(kw.cpa) : '—'}</td>
							<td class="py-1.5 text-right tabular-nums">{kw.ctr.toFixed(1)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
