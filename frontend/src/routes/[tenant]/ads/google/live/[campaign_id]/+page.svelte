<script lang="ts">
	import type { PageData } from './$types'
	import type { ChartConfiguration } from 'chart.js'
	import {
		ArrowLeft, Download, Target, DollarSign, Activity, ActivityIcon,
		Play, Pause, BarChart2, MousePointerClick, Loader2,
		AlertTriangle, AlertOctagon, CalendarDays, Gauge
	} from 'lucide-svelte'
	import { goto } from '$app/navigation'
	import { navigating } from '$app/stores'
	import { wowDelta } from '$lib/utils/metrics'
	import { getToken } from '$lib/api/client'
	import MetricCard from '$lib/components/ads/metric-card.svelte'
	import PerformanceChart from '$lib/components/ads/performance-chart.svelte'

	interface HistoryEntry { date: string; clicks: number; impressions: number }
	interface DbHistoryDay {
		date: string
		cost: number
		conversions: number
		clicks: number
		impressions: number
		cpa: number
		budgetMicros: number
	}

	let { data } = $props<{ data: PageData }>()

	let exporting = $state(false)
	let isLoadingPeriod = $derived(!!$navigating)

	const deltas = $derived({
		impressions: wowDelta(data.wow.cur.impressions, data.wow.prev.impressions),
		clicks: wowDelta(data.wow.cur.clicks, data.wow.prev.clicks),
		cost: wowDelta(data.wow.cur.cost, data.wow.prev.cost, true),
		conversions: wowDelta(data.wow.cur.conversions, data.wow.prev.conversions),
	})

	const apiChartConfig = $derived<ChartConfiguration>({
		type: 'line',
		data: {
			labels: data.campaign.history?.map((h: HistoryEntry) => h.date) ?? [],
			datasets: [
				{
					label: 'Clicks',
					data: data.campaign.history?.map((h: HistoryEntry) => h.clicks) ?? [],
					borderColor: '#3b82f6',
					backgroundColor: 'rgba(59,130,246,0.1)',
					yAxisID: 'y',
					tension: 0.4,
					fill: true,
				},
				{
					label: 'Impressions',
					data: data.campaign.history?.map((h: HistoryEntry) => h.impressions) ?? [],
					borderColor: '#8b5cf6',
					backgroundColor: 'transparent',
					yAxisID: 'y1',
					tension: 0.4,
					borderDash: [5, 5],
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: {
				y: { type: 'linear', position: 'left', title: { display: true, text: 'Clicks' } },
				y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Impressions' } },
			},
		},
	})

	const historyChartConfig = $derived<ChartConfiguration>({
		type: 'bar',
		data: {
			labels: data.dbHistory.map((d: DbHistoryDay) => d.date.substring(5)),
			datasets: [
				{
					type: 'bar',
					label: 'Cost (R$)',
					data: data.dbHistory.map((d: DbHistoryDay) => d.cost),
					backgroundColor: 'rgba(99,102,241,0.6)',
					borderColor: '#6366f1',
					borderWidth: 1,
					yAxisID: 'yCost',
				},
				{
					type: 'line',
					label: 'CPA (R$)',
					data: data.dbHistory.map((d: DbHistoryDay) => d.conversions > 0 ? d.cpa : null),
					borderColor: '#f59e0b',
					backgroundColor: 'transparent',
					pointBackgroundColor: '#f59e0b',
					pointRadius: 4,
					tension: 0.3,
					yAxisID: 'yCpa',
					spanGaps: false,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			plugins: {
				tooltip: {
					callbacks: {
						label: (ctx) => {
							if (ctx.dataset.label === 'Cost (R$)') return `Cost: R$${Number(ctx.raw).toFixed(2)}`
							if (ctx.dataset.label === 'CPA (R$)' && ctx.raw != null) return `CPA: R$${Number(ctx.raw).toFixed(2)}`
							return ''
						},
					},
				},
			},
			scales: {
				yCost: { type: 'linear', position: 'left', title: { display: true, text: 'Cost (R$)' }, beginAtZero: true },
				yCpa: { type: 'linear', position: 'right', title: { display: true, text: 'CPA (R$)' }, grid: { drawOnChartArea: false }, beginAtZero: true },
			},
		},
	})

	async function exportReport() {
		exporting = true
		try {
			// blob response (markdown file download) — cannot use apiFetch which calls res.json()
			const token = getToken()
			const res = await fetch(
				`/api/ads/google/${data.client.id}/live/${data.campaign.id}/export${window.location.search}`,
				{
					method: 'POST',
					credentials: 'include',
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				}
			)
			if (res.ok) {
				const blob = await res.blob()
				const url = window.URL.createObjectURL(blob)
				const a = document.createElement('a')
				a.href = url
				a.download = `campaign_${data.campaign.id}_report.md`
				document.body.appendChild(a)
				a.click()
				window.URL.revokeObjectURL(url)
				document.body.removeChild(a)
			} else {
				alert('Failed to generate report')
			}
		} catch {
			alert('Error exporting report')
		}
		exporting = false
	}

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

	function brl(v: number) {
		return 'R$' + v.toFixed(2)
	}

	function pacing_color(pct: number): string {
		if (pct > 0.9) return 'bg-emerald-500'
		if (pct > 0.5) return 'bg-amber-400'
		return 'bg-red-400'
	}
</script>

<!-- ── Toolbar ──────────────────────────────────────────────────────────── -->
<div
	class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-slate-900"
>
	<div class="flex items-center gap-4">
		<a
			href="/{data.tenant}/ads/google"
			class="text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<h2 class="flex items-center gap-2 text-lg font-semibold">
			<ActivityIcon class="h-4 w-4 text-emerald-500" />
			Live Campaign Details
		</h2>
	</div>
	<button
		onclick={exportReport}
		disabled={exporting}
		class="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
	>
		{#if exporting}
			<Loader2 class="h-4 w-4 animate-spin" /> Generating...
		{:else}
			<Download class="h-4 w-4" /> Export Markdown for AI
		{/if}
	</button>
</div>

<div
	class="mx-auto max-w-5xl space-y-6 p-6 {isLoadingPeriod
		? 'pointer-events-none opacity-50'
		: ''} relative"
>
	{#if isLoadingPeriod}
		<div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
			<div
				class="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-6 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-800"
			>
				<Loader2 class="h-5 w-5 animate-spin text-indigo-500" />
				<span class="font-medium text-slate-700 dark:text-slate-200">Updating report data...</span>
			</div>
		</div>
	{/if}

	<!-- ── Alert banner ─────────────────────────────────────────────────── -->
	{#if data.openAlerts.length > 0}
		<div
			class="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10"
		>
			{#each data.openAlerts as alert}
				<div class="flex items-start gap-3">
					{#if alert.level === 'CRITICAL'}
						<AlertOctagon class="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
					{:else}
						<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
					{/if}
					<div>
						<span class="mr-2 text-xs font-bold tracking-wide text-red-700 uppercase dark:text-red-300">{alert.level}</span>
						<span class="text-sm text-red-800 dark:text-red-200">{alert.message}</span>
						{#if alert.action_suggested}
							<p class="mt-0.5 text-xs text-red-600 dark:text-red-400">→ {alert.action_suggested}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- ── Header card ──────────────────────────────────────────────────── -->
	<div
		class="relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center dark:border-slate-800 dark:bg-slate-900"
	>
		<div class="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl"></div>
		<div class="relative z-10">
			<div class="mb-2 flex items-center gap-2">
				<span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500 dark:bg-slate-800">ID: {data.campaign.id}</span>
				{#if data.campaign.status === 'ENABLED'}
					<span class="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-700 uppercase dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-400">
						<Play class="h-3 w-3" /> Active
					</span>
				{:else}
					<span class="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-600 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
						<Pause class="h-3 w-3" /> Paused
					</span>
				{/if}
			</div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{data.campaign.name}</h1>
			<p class="mt-2 flex items-center gap-2 text-sm text-slate-500">
				<Target class="h-4 w-4" /> Bidding:
				<span class="font-medium text-slate-700 dark:text-slate-300">{data.campaign.strategy}</span>
			</p>
		</div>
		<div class="relative z-10 flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700/50 dark:bg-slate-800/50">
			<button onclick={() => clearPeriod()} disabled={isLoadingPeriod} class="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:shadow-sm disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700">All Time</button>
			<button onclick={() => setPeriod(7)} disabled={isLoadingPeriod} class="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:shadow-sm disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700">7 Days</button>
			<button onclick={() => setPeriod(30)} disabled={isLoadingPeriod} class="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:shadow-sm disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700">30 Days</button>
		</div>
	</div>

	<!-- ── 4 metric cards (with WoW delta) ──────────────────────────────── -->
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
		<MetricCard icon={Activity} theme="indigo" label="Impressions" value={data.campaign.metrics.impressions} subtitle="Share: {data.campaign.metrics.searchImpressionShare}" delta={deltas.impressions} />
		<MetricCard icon={MousePointerClick} theme="blue" label="Clicks" value={data.campaign.metrics.clicks} subtitle="CTR: {data.campaign.metrics.ctr}" delta={deltas.clicks} />
		<MetricCard icon={DollarSign} theme="emerald" label="Total Cost" value="${data.campaign.metrics.cost}" delta={deltas.cost} />
		<MetricCard icon={Target} theme="amber" label="Conversions" value={data.campaign.metrics.conversions} subtitle="CPA: ${data.campaign.metrics.cpa}" delta={deltas.conversions} />
	</div>

	<!-- ── Budget pacing + Monthly summary ──────────────────────────────── -->
	{#if data.budgetPacing || data.monthly}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#if data.budgetPacing}
				{@const p = data.budgetPacing}
				<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div class="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
						<div class="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800">
							<Gauge class="h-4 w-4" />
						</div>
						Budget Pacing —<span class="font-mono text-xs">{p.date}</span>
					</div>
					<div class="mb-2 flex items-end justify-between">
						<span class="text-2xl font-bold text-slate-900 dark:text-white">{brl(p.cost)}</span>
						<span class="text-sm text-slate-500">of {brl(p.budget)}/day</span>
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
						<div class="h-2 rounded-full transition-all {pacing_color(p.pct)}" style="width: {Math.min(p.pct * 100, 100).toFixed(0)}%"></div>
					</div>
					<p class="mt-1.5 text-right text-xs text-slate-400">{(p.pct * 100).toFixed(0)}% used</p>
				</div>
			{/if}
			{#if data.monthly}
				{@const m = data.monthly}
				<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div class="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
						<div class="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800">
							<CalendarDays class="h-4 w-4" />
						</div>
						Current Month — MTD
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">Spend</p>
							<p class="text-xl font-bold text-slate-900 dark:text-white">{brl(m.totalCost)}</p>
						</div>
						<div>
							<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">Conversions</p>
							<p class="text-xl font-bold text-slate-900 dark:text-white">{m.totalConversions}</p>
						</div>
						<div>
							<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">Active Days</p>
							<p class="text-xl font-bold text-slate-900 dark:text-white">{m.daysActive}</p>
						</div>
						<div>
							<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">Avg CPA</p>
							<p class="text-xl font-bold text-slate-900 dark:text-white">{m.avgCpa > 0 ? brl(m.avgCpa) : '—'}</p>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ── Charts ───────────────────────────────────────────────────────── -->
	{#if data.campaign.history && data.campaign.history.length > 0}
		<PerformanceChart config={apiChartConfig} title="Performance Timeline" source="source: Google Ads API" icon={Activity} />
	{/if}
	{#if data.dbHistory.length > 0}
		<PerformanceChart config={historyChartConfig} title="Daily Cost + CPA — 30 days" source="source: local monitoring" note="CPA plotted only on days with conversions" icon={BarChart2} />
	{/if}

	<!-- ── Ad groups ────────────────────────────────────────────────────── -->
	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
		<div class="border-b border-slate-200 bg-slate-50/50 px-6 py-5 dark:border-slate-800 dark:bg-slate-800/20">
			<h3 class="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
				<BarChart2 class="h-5 w-5 text-indigo-500" /> Ad Groups Breakdown
			</h3>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-slate-200 bg-slate-50 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
					<tr>
						<th class="px-6 py-4">Ad Group</th>
						<th class="px-6 py-4">Status</th>
						<th class="px-6 py-4 text-right">Impressions</th>
						<th class="px-6 py-4 text-right">Clicks</th>
						<th class="px-6 py-4 text-right">Cost</th>
						<th class="px-6 py-4 text-right">Conv.</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200 dark:divide-slate-800">
					{#each data.campaign.adGroups as group}
						<tr class="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
							<td class="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">{group.name}</td>
							<td class="px-6 py-4">
								<span class="rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase {group.status === 'ENABLED' ? 'border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-400' : 'border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}">
									{group.status}
								</span>
							</td>
							<td class="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-400">{group.metrics.impressions}</td>
							<td class="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-400">{group.metrics.clicks}</td>
							<td class="px-6 py-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">${group.metrics.cost}</td>
							<td class="px-6 py-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">{group.metrics.conversions}</td>
						</tr>
					{/each}
					{#if data.campaign.adGroups.length === 0}
						<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500">No ad groups found.</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
