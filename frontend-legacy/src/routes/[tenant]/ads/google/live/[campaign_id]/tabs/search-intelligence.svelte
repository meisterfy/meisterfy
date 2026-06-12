<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import { isSmartManaged } from '$lib/api/campaigns'
	import type {
		LiveCampaignDetail,
		SearchTermRow,
		KeywordQSRow,
		KeywordPerfRow
	} from '$lib/api/campaigns'

	import SearchTermsTable from '../components/search-terms-table.svelte'
	import QualityScoreTable from '../components/quality-score-table.svelte'
	import KeywordPerformanceTable from '../components/keyword-performance-table.svelte'

	let { detail, searchTerms, qualityScores, keywords } = $props<{
		detail: Promise<LiveCampaignDetail | null>
		searchTerms: Promise<SearchTermRow[]>
		qualityScores: Promise<KeywordQSRow[]>
		keywords: Promise<KeywordPerfRow[]>
	}>()
</script>

<div class="space-y-6 py-6">
	{#await detail then d}
		{@const smart = d ? isSmartManaged(d.campaign.adGroups) : false}

		{#if smart}
			<p class="text-sm text-slate-400">{m['ads:analytics.smart_campaign_no_keywords']()}</p>
		{:else}
			{#await qualityScores}
				<div class="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"></div>
			{:then qs}
				{#if qs.length > 0}
					<QualityScoreTable keywords={qs} />
				{/if}
			{/await}

			{#await keywords}
				<div class="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"></div>
			{:then kw}
				{#if kw.length > 0}
					<KeywordPerformanceTable keywords={kw} />
				{/if}
			{/await}
		{/if}

		{#await searchTerms}
			<div class="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"></div>
		{:then terms}
			{#if terms.length > 0}
				<SearchTermsTable {terms} />
			{/if}
		{/await}
	{/await}
</div>
