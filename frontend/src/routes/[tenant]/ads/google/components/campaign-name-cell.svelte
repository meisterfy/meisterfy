<script lang="ts">
	import { Search } from 'lucide-svelte'

	let { name, id, slug, type, objective, tenant } = $props<{
		name: string
		id: string
		slug?: string
		type: 'live' | 'local'
		objective?: string
		tenant: string
	}>()
</script>

<div class="flex items-center gap-3">
	{#if type === 'local'}
		<div
			class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30"
		>
			<Search class="h-4 w-4" />
		</div>
	{/if}
	<div>
		<a
			href={type === 'live' ? `/${tenant}/ads/google/live/${id}` : `/${tenant}/ads/google/${slug}`}
			class="block font-bold text-slate-900 transition-colors hover:text-indigo-600 dark:text-white"
		>
			{type === 'live' ? name : id}
		</a>
		{#if type === 'local' && objective}
			<span class="text-xs text-slate-500">{objective}</span>
		{:else if type === 'live'}
			<span class="text-xs text-slate-500">Live in Google Ads</span>
		{/if}
	</div>
</div>
