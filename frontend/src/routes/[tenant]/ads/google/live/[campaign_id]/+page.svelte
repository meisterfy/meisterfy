<script lang="ts">
	import type { PageData } from './$types'
	import { goto } from '$app/navigation'
	import { navigating } from '$app/stores'
	import { m } from '$lib/paraglide/messages'
	import { Tabs } from 'bits-ui'

	import TabTrigger from './tabs/tab-trigger.svelte'
	import LiveTab from './tabs/live.svelte'
	import HistoryTab from './tabs/history.svelte'
	import SearchIntelligenceTab from './tabs/search-intelligence.svelte'
	import Header from './components/header.svelte'
	import { createCampaignActions } from '$lib/runes/campaign-actions.svelte'

	let { data } = $props<{ data: PageData }>()
	const actions = createCampaignActions()

	let isLoadingPeriod = $derived(!!$navigating)

	function setPeriod(days: number) {
		const end = new Date()
		const start = new Date()
		start.setDate(end.getDate() - days)
		const fmt = (d: Date) => d.toISOString().split('T')[0]
		goto(`?startDate=${fmt(start)}&endDate=${fmt(end)}`, { keepFocus: true })
	}

	function clearPeriod() {
		goto('?', { keepFocus: true })
	}
</script>

<div class="p-4 lg:p-8 gap-4">
	{#await data.streamed.detail}
		<div class="pb-4 flex flex-col lg:flex-row items-end justify-between gap-4 border-b border-white/10 animate-pulse">
			<div class="flex flex-col gap-2">
				<div class="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700"></div>
				<div class="h-10 w-72 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
				<div class="flex gap-2">
					<div class="h-5 w-24 rounded bg-slate-100 dark:bg-slate-800"></div>
					<div class="h-5 w-16 rounded bg-slate-100 dark:bg-slate-800"></div>
				</div>
			</div>
			<div class="flex gap-2">
				<div class="h-8 w-20 rounded-md bg-slate-100 dark:bg-slate-800"></div>
				<div class="h-8 w-28 rounded-md bg-slate-200 dark:bg-slate-700"></div>
			</div>
		</div>
	{:then detail}
		<Header {detail} tenant={data.tenant} campaignId={data.campaignId} {actions} />
	{/await}

	<Tabs.Root value="live">
		<Tabs.List class="flex items-center justify-start gap-2 lg:gap-4 py-4 border-b border-white/10">
			<TabTrigger value="live">
				<div class="flex items-center gap-2">
					{m['ads:headings.live_performance']()}
					<span class="rounded-full bg-green-400/70 w-2 h-2 animate-pulse"></span>
				</div>
			</TabTrigger>
			<TabTrigger value="history">
				{m['ads:headings.campaign_history']()}
			</TabTrigger>
			<TabTrigger value="search">
				{m['ads:headings.search_intelligence']()}
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
	</Tabs.Root>
</div>
