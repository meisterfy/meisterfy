<script lang="ts">
	import { Activity, CircleAlert, CircleCheck } from 'lucide-svelte'
	import * as m from '$lib/paraglide/messages.js'

	let { status, type } = $props<{ status: string; type: 'live' | 'local' }>()
</script>

{#if type === 'live'}
	{#if status === 'ENABLED'}
		<span
			class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400"
		>
			<Activity class="h-3.5 w-3.5" />
			{m['ads:status.active']()}
		</span>
	{:else if status === 'PAUSED'}
		<span
			class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
		>
			<CircleAlert class="h-3.5 w-3.5" />
			{m['ads:status.paused']()}
		</span>
	{:else}
		<span
			class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
		>
			{status}
		</span>
	{/if}
{:else if status === 'draft'}
	<span
		class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400"
	>
		<CircleAlert class="h-3.5 w-3.5" /> Draft
	</span>
{:else if status === 'approved'}
	<span
		class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400"
	>
		<CircleCheck class="h-3.5 w-3.5" /> Approved
	</span>
{:else}
	<span
		class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
	>
		<Activity class="h-3.5 w-3.5" />
		{status}
	</span>
{/if}
