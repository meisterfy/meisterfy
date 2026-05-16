<script lang="ts">
	import { Search, X } from 'lucide-svelte'
	import * as Select from '$lib/components/ui/select'
	import { Input } from '$lib/components/ui/input'

	let {
		searchQuery = $bindable(),
		selectedCategory = $bindable(),
		categories,
		categoryLabels,
		onClear
	} = $props<{
		searchQuery: string
		selectedCategory: string
		categories: string[]
		categoryLabels: Record<string, string>
		onClear: () => void
	}>()
</script>

<div class="flex flex-wrap items-center gap-3">
	{#if searchQuery !== '' || selectedCategory !== 'all'}
		<button
			onclick={onClear}
			class="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
		>
			Clear filters
		</button>
	{/if}

	<div class="relative min-w-[240px]">
		<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
		<Input placeholder="Search connections..." bind:value={searchQuery} class="pr-10 pl-9" />
		{#if searchQuery}
			<button
				onclick={() => (searchQuery = '')}
				class="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		{/if}
	</div>

	<Select.Root type="single" bind:value={selectedCategory}>
		<Select.Trigger
			class="w-[200px] border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
		>
			{selectedCategory === 'all'
				? 'All Categories'
				: (categoryLabels[selectedCategory] ?? selectedCategory)}
		</Select.Trigger>
		<Select.Content>
			<Select.Item value="all">All Categories</Select.Item>
			{#each categories as group (group)}
				<Select.Item value={group}>{categoryLabels[group] ?? group}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
