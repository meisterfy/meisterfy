<script lang="ts">
	import { untrack } from 'svelte'
	import type { PageData } from './$types'
	import { goto } from '$app/navigation'
	import { navigating } from '$app/state'
	import { m } from '$lib/paraglide/messages'
	import { Tabs } from 'bits-ui'
	import TabTrigger from './tabs/tab-trigger.svelte'
	import LiveTab from './tabs/live.svelte'
	import HistoryTab from './tabs/history.svelte'
	import SearchIntelligenceTab from './tabs/search-intelligence.svelte'
	import AiReportTab from './tabs/ai-report.svelte'
	import Header from './components/header.svelte'
	import FloatingChat from '$lib/components/chat/floating-chat.svelte'
	import { createCampaignActions } from '$lib/runes/campaign-actions.svelte'
	import { createCampaignChat } from '$lib/stores/campaign-chat.svelte'
	import { buildCampaignData, buildChatSystemPrompt } from '$lib/ai/campaign-context'
	import Skeleton from './components/skeleton.svelte'

	let { data } = $props<{ data: PageData }>()
	const actions = createCampaignActions()
	const chat = createCampaignChat(data.tenant, data.campaignId)

	// Build system prompt as soon as campaign data resolves — independent of the AI Report tab.
	let chatSystemPrompt = $state('')
	const {
		detail: detailP,
		searchTerms: searchTermsP,
		keywords: keywordsP,
		qualityScores: qualityScoresP
	} = untrack(() => data.streamed)
	Promise.all([detailP, searchTermsP, keywordsP, qualityScoresP]).then(
		([detail, terms, kw, qs]) => {
			if (detail) {
				chatSystemPrompt = buildChatSystemPrompt(
					data.client.brand,
					buildCampaignData(detail, terms, kw, qs)
				)
			}
		}
	)

	let isLoadingPeriod = $derived(!!navigating.to)

	function setPeriod(days: number) {
		const end = new Date()
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const start = new Date()
		start.setDate(end.getDate() - days)
		const fmt = (d: Date) => d.toISOString().split('T')[0]
		// relative navigation — only updates query params, resolve() requires absolute paths
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`?startDate=${fmt(start)}&endDate=${fmt(end)}`, { keepFocus: true })
	}

	function clearPeriod() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto('?', { keepFocus: true })
	}
</script>

<div class="gap-4 p-4 lg:p-8">
	{#await data.streamed.detail}
		<Skeleton />
	{:then detail}
		<Header {detail} tenant={data.tenant} campaignId={data.campaignId} {actions} />
	{/await}

	<Tabs.Root value="live">
		<Tabs.List class="flex items-center justify-start gap-2 border-b border-white/10 py-4 lg:gap-4">
			<TabTrigger value="live">
				<div class="flex items-center gap-2">
					{m['ads:headings.live_performance']()}
					<span class="h-2 w-2 animate-pulse rounded-full bg-green-400/70"></span>
				</div>
			</TabTrigger>
			<TabTrigger value="history">
				{m['ads:headings.campaign_history']()}
			</TabTrigger>
			<TabTrigger value="search">
				{m['ads:headings.search_intelligence']()}
			</TabTrigger>
			<TabTrigger value="ai">
				<div class="flex items-center gap-1.5">
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						><path
							d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
						/></svg
					>
					{m['ads:headings.ai_report']()}
				</div>
			</TabTrigger>
		</Tabs.List>

		<Tabs.Content value="live">
			<LiveTab
				detail={data.streamed.detail}
				{isLoadingPeriod}
				onSetPeriod={setPeriod}
				onClearPeriod={clearPeriod}
				devices={data.streamed.devices}
				hourly={data.streamed.hourly}
				impressionShare={data.streamed.impressionShare}
			/>
		</Tabs.Content>

		<Tabs.Content value="history">
			<HistoryTab dbHistory={data.streamed.dbHistory} />
		</Tabs.Content>

		<Tabs.Content value="search">
			<SearchIntelligenceTab
				detail={data.streamed.detail}
				searchTerms={data.streamed.searchTerms}
				qualityScores={data.streamed.qualityScores}
				keywords={data.streamed.keywords}
			/>
		</Tabs.Content>

		<Tabs.Content value="ai">
			<AiReportTab
				tenant={data.tenant}
				campaignId={data.campaignId}
				brand={data.client.brand}
				detail={data.streamed.detail}
				searchTerms={data.streamed.searchTerms}
				keywords={data.streamed.keywords}
				qualityScores={data.streamed.qualityScores}
			/>
		</Tabs.Content>
	</Tabs.Root>
</div>

<!-- Floating AI chat — persists across tab switches -->
<FloatingChat
	{chat}
	systemPrompt={chatSystemPrompt}
	tenantId={data.tenant}
	campaignId={data.campaignId}
/>
