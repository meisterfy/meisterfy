<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import { brl } from '$lib/utils/format'
	import type { SearchTermRow } from '$lib/api/campaigns'

	let { terms } = $props<{ terms: SearchTermRow[] }>()

	const avgCost = $derived(
		terms.length > 0
			? terms.reduce((s: number, t: SearchTermRow) => s + t.cost, 0) / terms.length
			: 0
	)

	const converting = $derived(
		[...terms.filter((t: SearchTermRow) => t.conversions > 0)].sort(
			(a, b) => b.conversions - a.conversions
		)
	)

	const wasted = $derived(
		[...terms.filter((t: SearchTermRow) => t.conversions === 0 && t.cost > avgCost)]
			.sort((a, b) => b.cost - a.cost)
			.slice(0, 20)
	)

	let copyLabel = $state(m['ads:analytics.search_terms_copy_csv']())
	let fallbackCsv = $state<string | null>(null)

	function buildCsv(): string {
		const rows = wasted.map((t) => `"${t.term.replace(/"/g, '""')}",${brl(t.cost)},${t.clicks}`)
		return ['Term,Cost,Clicks', ...rows].join('\n')
	}

	async function copyAsCsv() {
		const csv = buildCsv()
		try {
			await navigator.clipboard.writeText(csv)
			copyLabel = m['ads:analytics.search_terms_copied']()
			setTimeout(() => (copyLabel = m['ads:analytics.search_terms_copy_csv']()), 2000)
		} catch {
			fallbackCsv = csv
		}
	}

	function statusBadge(status: string) {
		if (status === 'EXCLUDED')
			return {
				label: 'Negative',
				cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
			}
		if (status === 'ADDED')
			return {
				label: 'Keyword',
				cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
			}
		return null
	}
</script>

<div class="space-y-4 rounded-xl border border-white/10 bg-white p-4 dark:bg-slate-900">
	<h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
		{m['ads:analytics.search_terms_title']()}
	</h3>

	{#if terms.length === 0}
		<p class="text-sm text-slate-400">{m['ads:analytics.search_terms_empty']()}</p>
	{:else}
		{#if converting.length > 0}
			<section class="space-y-2">
				<div>
					<p class="text-xs font-semibold text-slate-600 dark:text-slate-300">
						{m['ads:analytics.search_terms_converting']()}
					</p>
					<p class="text-xs text-slate-400">{m['ads:analytics.search_terms_converting_hint']()}</p>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-xs">
						<thead>
							<tr class="border-b border-white/10 text-left text-slate-500">
								<th class="pr-3 pb-1 font-medium">Search Term</th>
								<th class="pr-3 pb-1 text-right font-medium">Clicks</th>
								<th class="pr-3 pb-1 text-right font-medium">Conv.</th>
								<th class="pr-3 pb-1 text-right font-medium">Cost</th>
								<th class="pr-3 pb-1 text-right font-medium">CPA</th>
								<th class="pr-3 pb-1 text-right font-medium">CTR</th>
								<th class="pb-1 font-medium">Status</th>
							</tr>
						</thead>
						<tbody>
							{#each converting as t (t.term)}
								{@const badge = statusBadge(t.status)}
								<tr class="border-b border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
									<td class="max-w-[200px] truncate py-1.5 pr-3 text-slate-700 dark:text-slate-200"
										>{t.term}</td
									>
									<td class="py-1.5 pr-3 text-right tabular-nums">{t.clicks}</td>
									<td class="py-1.5 pr-3 text-right tabular-nums">{t.conversions}</td>
									<td class="py-1.5 pr-3 text-right tabular-nums">{brl(t.cost)}</td>
									<td class="py-1.5 pr-3 text-right tabular-nums">{t.cpa > 0 ? brl(t.cpa) : '—'}</td
									>
									<td class="py-1.5 pr-3 text-right tabular-nums">{t.ctr.toFixed(1)}%</td>
									<td class="py-1.5">
										{#if badge}
											<span class="rounded-full px-1.5 py-0.5 text-[10px] font-medium {badge.cls}"
												>{badge.label}</span
											>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/if}

		{#if wasted.length > 0}
			<section class="space-y-2">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-semibold text-slate-600 dark:text-slate-300">
							{m['ads:analytics.search_terms_wasted']()}
						</p>
						<p class="text-xs text-slate-400">{m['ads:analytics.search_terms_wasted_hint']()}</p>
					</div>
					<button
						onclick={copyAsCsv}
						class="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
					>
						{copyLabel}
					</button>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-xs">
						<thead>
							<tr class="border-b border-white/10 text-left text-slate-500">
								<th class="pr-3 pb-1 font-medium">Search Term</th>
								<th class="pr-3 pb-1 text-right font-medium">Clicks</th>
								<th class="pr-3 pb-1 text-right font-medium">Conv.</th>
								<th class="pr-3 pb-1 text-right font-medium">Cost</th>
								<th class="pr-3 pb-1 text-right font-medium">CTR</th>
								<th class="pb-1 font-medium">Status</th>
							</tr>
						</thead>
						<tbody>
							{#each wasted as t (t.term)}
								{@const badge = statusBadge(t.status)}
								<tr class="border-b border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
									<td class="max-w-[200px] truncate py-1.5 pr-3 text-slate-700 dark:text-slate-200"
										>{t.term}</td
									>
									<td class="py-1.5 pr-3 text-right tabular-nums">{t.clicks}</td>
									<td class="py-1.5 pr-3 text-right tabular-nums">0</td>
									<td class="py-1.5 pr-3 text-right tabular-nums">{brl(t.cost)}</td>
									<td class="py-1.5 pr-3 text-right tabular-nums">{t.ctr.toFixed(1)}%</td>
									<td class="py-1.5">
										{#if badge}
											<span class="rounded-full px-1.5 py-0.5 text-[10px] font-medium {badge.cls}"
												>{badge.label}</span
											>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if fallbackCsv !== null}
					<div class="space-y-1">
						<p class="text-xs text-slate-500">{m['ads:analytics.search_terms_copy_fallback']()}</p>
						<textarea
							readonly
							rows={5}
							class="w-full rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
							>{fallbackCsv}</textarea
						>
					</div>
				{/if}
			</section>
		{/if}
	{/if}
</div>
