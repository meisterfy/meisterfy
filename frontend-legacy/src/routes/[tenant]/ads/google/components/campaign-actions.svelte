<script lang="ts">
	import { resolve } from '$app/paths'
	import { Activity, SquarePen, Trash2, Send } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'
	import type { UnifiedCampaign } from '../columns'

	let { campaign, onDeploy } = $props<{
		campaign: UnifiedCampaign
		onDeploy?: (slug: string) => void
	}>()

	// External state for deploying status would be better, but for now we can pass it or use a global store
	// Since we are refactoring, let's keep it simple and assume the parent manages the actual deployment logic
</script>

<div
	class="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100"
>
	{#if campaign.type === 'live'}
		<a
			href={resolve(`/${campaign.tenant}/ads/google/live/${campaign.id}`)}
			class="rounded border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-indigo-900/30"
			title={m['ads:view_detailed_report']()}
		>
			<Activity class="h-4 w-4" />
		</a>
	{:else}
		{#if campaign.status === 'approved' && onDeploy}
			<button
				onclick={() => campaign.slug && onDeploy(campaign.slug)}
				class="rounded border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-emerald-900/30"
				title={m['ads:deploy_to_google_ads']()}
			>
				<Send class="h-4 w-4" />
			</button>
		{/if}
		<a
			href={resolve(`/${campaign.tenant}/ads/google/${campaign.slug}`)}
			class="rounded border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-indigo-900/30"
			title="Edit"
		>
			<SquarePen class="h-4 w-4" />
		</a>
		<button
			class="rounded border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-red-900/30"
			title="Delete"
		>
			<Trash2 class="h-4 w-4" />
		</button>
	{/if}
</div>
