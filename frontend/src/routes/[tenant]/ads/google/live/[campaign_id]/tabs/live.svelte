<script lang="ts">
	import { Target, DollarSign, Activity, MousePointerClick, Percent, CreditCard } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'
	import type { LiveCampaignDetail } from '$lib/api/campaigns'
	import { isSmartManaged } from '$lib/api/campaigns'
	import { wowDelta } from '$lib/utils/metrics'
	import { brl } from '$lib/utils/format'
	import { createPerformanceTimelineConfig } from '$lib/utils/charts'

	import type { DeviceRow, HourlyRow, ImpressionShareStats } from '$lib/api/campaigns'
	import MetricCard from '$lib/components/ads/metric-card.svelte'
	import PerformanceChart from '$lib/components/ads/performance-chart.svelte'
	import AlertBanner from '../components/alert-banner.svelte'
	import AdsGroupsList from '../components/ads-groups-list.svelte'
	import BudgetPacingCard from '../components/budget-pacing-card.svelte'
	import Loading from '../components/loading.svelte'
	import ImpressionShareCard from '../components/impression-share-card.svelte'
	import DeviceBreakdown from '../components/device-breakdown.svelte'
	import HourlyHeatmap from '../components/hourly-heatmap.svelte'

	let {
		detail,
		isLoadingPeriod,
		onSetPeriod,
		onClearPeriod,
		devices,
		hourly,
		impressionShare,
	} = $props<{
		detail: Promise<LiveCampaignDetail | null>
		isLoadingPeriod: boolean
		onSetPeriod: (days: number) => void
		onClearPeriod: () => void
		devices: Promise<DeviceRow[]>
		hourly: Promise<HourlyRow[]>
		impressionShare: Promise<ImpressionShareStats | null>
	}>()

	function getDeltas(d: LiveCampaignDetail) {
		const curCvr = d.wow.cur.clicks > 0 ? d.wow.cur.conversions / d.wow.cur.clicks : 0
		const prevCvr = d.wow.prev.clicks > 0 ? d.wow.prev.conversions / d.wow.prev.clicks : 0
		const curCpc = d.wow.cur.clicks > 0 ? d.wow.cur.cost / d.wow.cur.clicks : 0
		const prevCpc = d.wow.prev.clicks > 0 ? d.wow.prev.cost / d.wow.prev.clicks : 0
		return {
			impressions: wowDelta(d.wow.cur.impressions, d.wow.prev.impressions),
			clicks: wowDelta(d.wow.cur.clicks, d.wow.prev.clicks),
			cost: wowDelta(d.wow.cur.cost, d.wow.prev.cost, true),
			conversions: wowDelta(d.wow.cur.conversions, d.wow.prev.conversions),
			cvr: wowDelta(curCvr, prevCvr),
			cpc: wowDelta(curCpc, prevCpc, true),
		}
	}

	const PERIODS = [
		{ label: '7D', days: 7 },
		{ label: '14D', days: 14 },
		{ label: '30D', days: 30 },
	]
</script>

<div class="space-y-6 py-6 relative {isLoadingPeriod ? 'pointer-events-none opacity-50' : ''}">
	{#if isLoadingPeriod}<Loading />{/if}

	<div class="flex items-center gap-2">
		<span class="text-xs font-medium text-slate-500 dark:text-slate-400">{m['ads:period']()}:</span>
		{#each PERIODS as { label, days }}
			<button
				onclick={() => onSetPeriod(days)}
				class="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
			>
				{label}
			</button>
		{/each}
		<button
			onclick={onClearPeriod}
			class="text-xs font-medium text-slate-400 underline-offset-2 hover:underline dark:text-slate-500"
		>
			{m['ads:all_time']()}
		</button>
	</div>

	{#await detail}
		<div class="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6 animate-pulse">
			{#each Array(6) as _}
				<div class="h-32 rounded-xl bg-slate-100 dark:bg-slate-800"></div>
			{/each}
		</div>
	{:then d}
		{#if d}
			{#if d.openAlerts.length > 0}
				<AlertBanner data={{ openAlerts: d.openAlerts }} />
			{/if}

			{#if d.budgetPacing}
				<BudgetPacingCard pacing={d.budgetPacing} />
			{/if}

			{@const deltas = getDeltas(d)}
			{@const cvrValue = d.wow.cur.clicks > 0 ? (d.wow.cur.conversions / d.wow.cur.clicks * 100).toFixed(2) + '%' : '—'}
			{@const cpcValue = d.wow.cur.clicks > 0 ? brl(d.wow.cur.cost / d.wow.cur.clicks) : '—'}
			<div class="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
				<MetricCard icon={Activity} theme="indigo" label={m['ads:impressions']()} value={d.campaign.metrics.impressions} subtitle={`${m['ads:share']()}: ${d.campaign.metrics.searchImpressionShare}`} delta={deltas.impressions} />
				<MetricCard icon={MousePointerClick} theme="blue" label={m['ads:clicks']()} value={d.campaign.metrics.clicks} subtitle={`${m['ads:ctr']()}: ${d.campaign.metrics.ctr}`} delta={deltas.clicks} />
				<MetricCard icon={DollarSign} theme="emerald" label={m['ads:total_cost']()} value={d.campaign.metrics.cost} delta={deltas.cost} />
				<MetricCard icon={Target} theme="amber" label={m['ads:conversions']()} value={d.campaign.metrics.conversions} subtitle={`${m['ads:cpa']()}: ${d.campaign.metrics.cpa}`} delta={deltas.conversions} />
				<MetricCard icon={Percent} theme="rose" label={m['ads:cvr']()} value={cvrValue} delta={deltas.cvr} />
				<MetricCard icon={CreditCard} theme="slate" label={m['ads:cpc']()} value={cpcValue} delta={deltas.cpc} />
			</div>

			{#if d.campaign.history.length > 0}
				<PerformanceChart config={createPerformanceTimelineConfig(d.campaign.history)} title={m['ads:graph.performance_timeline']()} source={m['ads:graph.source']({ source: 'Google Ads API' })} icon={Activity} />
			{/if}

			{#if !isSmartManaged(d.campaign.adGroups)}
				<AdsGroupsList adGroups={d.campaign.adGroups} />
			{/if}

			{#await impressionShare}
				<div class="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"></div>
			{:then is}
				<ImpressionShareCard stats={is} />
			{/await}

			{#await devices}
				<div class="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"></div>
			{:then devs}
				<DeviceBreakdown devices={devs} />
			{/await}

			{#await hourly}
				<div class="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"></div>
			{:then hrs}
				<HourlyHeatmap hourly={hrs} />
			{/await}
		{/if}
	{/await}
</div>
