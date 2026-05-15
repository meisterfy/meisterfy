<script lang="ts">
	import {
		ArrowLeft, Download, Target, Play, Pause, RefreshCw, LoaderCircle
	} from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'
	import { formatStrategy } from '$lib/utils/ads'
	import type { LiveCampaignDetail } from '$lib/api/campaigns'

	let {
		detail,
		tenant,
		campaignId,
		actions,
	} = $props<{
		detail: LiveCampaignDetail | null
		tenant: string
		campaignId: string
		actions: any
	}>()
</script>

<div class="pb-4 flex flex-col lg:flex-row items-end justify-between gap-2 border-b border-white/10">
	<div class="flex flex-col items-start justify-start gap-2 lg:gap-4">
		<a href="/{tenant}/ads/google" class="text-slate-500 hover:text-slate-900 dark:hover:text-slate-300">
			<ArrowLeft class="h-4 w-4" />
		</a>
		<h1 class="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
			{detail?.campaign.name ?? 'Campaign'}
		</h1>
		<div class="flex items-start justify-start gap-2 lg:gap-4">
			<span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500 dark:bg-slate-800">ID: {detail?.campaign.id ?? campaignId}</span>
			{#if detail}
				<span class="inline-flex items-center gap-1 rounded border {detail.campaign.status === 'ENABLED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-400' : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'} px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
					{#if detail.campaign.status === 'ENABLED'}
						<Play class="h-3 w-3" /> {m['ads:status.active']()}
					{:else}
						<Pause class="h-3 w-3" /> {m['ads:status.paused']()}
					{/if}
				</span>
				<p class="flex items-center gap-1 text-sm text-slate-500">
					<Target class="h-4 w-4" />
					<span class="font-medium text-slate-700 dark:text-slate-300">
						{formatStrategy(detail.campaign.strategy)}
					</span>
				</p>
			{/if}
		</div>
	</div>
	
	<div class="flex items-center justify-end gap-2">
		<button
			onclick={() => actions.runSyncHistory(tenant)}
			disabled={actions.syncing}
			class="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
		>
			{#if actions.syncing}
				<LoaderCircle class="h-4 w-4 animate-spin" /> {m['ads:syncing']()}
			{:else}
				<RefreshCw class="h-4 w-4" /> {m['ads:sync']()}
			{/if}
		</button>
		<button
			onclick={() => detail && actions.exportReport(detail.campaign.id, detail.client.id)}
			disabled={actions.exporting || !detail}
			class="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
		>
			{#if actions.exporting}
				<LoaderCircle class="h-4 w-4 animate-spin" /> {m['ads:generating']()}
			{:else}
				<Download class="h-4 w-4" /> {m['ads:ia_export']()}
			{/if}
		</button>
	</div>
</div>
