<script lang="ts">
	import { Popover } from 'bits-ui';
	import { Check, ChevronsUpDown } from 'lucide-svelte';

	let {
		value = $bindable<string[]>([]),
		options,
		placeholder = 'Select…',
	}: {
		value: string[];
		options: { value: string; label: string }[];
		placeholder?: string;
	} = $props();

	let open = $state(false);
	let search = $state('');

	const filtered = $derived(
		options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
	);

	const selectedLabels = $derived(value.map((v) => options.find((o) => o.value === v)?.label ?? v));

	function toggle(val: string) {
		value = value.includes(val) ? value.filter((v) => v !== val) : [...value, val];
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
	>
		<div class="flex min-w-0 flex-1 flex-wrap gap-1">
			{#if value.length === 0}
				<span class="text-slate-400">{placeholder}</span>
			{:else}
				{#each selectedLabels as label}
					<span
						class="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
					>
						{label}
					</span>
				{/each}
			{/if}
		</div>
		<ChevronsUpDown class="h-4 w-4 shrink-0 text-slate-400" />
	</Popover.Trigger>

	<Popover.Content
		class="z-50 mt-1 min-w-48 w-[var(--bits-popover-anchor-width)] rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
		align="start"
		sideOffset={4}
	>
		<div class="border-b border-slate-100 px-2 py-1.5 dark:border-slate-700">
			<input
				type="text"
				bind:value={search}
				placeholder="Search…"
				class="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:text-white"
			/>
		</div>
		<div class="mt-1 max-h-48 overflow-y-auto">
			{#each filtered as option}
				<button
					type="button"
					onclick={() => toggle(option.value)}
					class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
				>
					<div
						class="flex h-4 w-4 shrink-0 items-center justify-center rounded border {value.includes(option.value)
							? 'border-indigo-600 bg-indigo-600'
							: 'border-slate-300 dark:border-slate-600'}"
					>
						{#if value.includes(option.value)}
							<Check class="h-3 w-3 text-white" />
						{/if}
					</div>
					{option.label}
				</button>
			{/each}
			{#if filtered.length === 0}
				<p class="py-3 text-center text-xs text-slate-400">No options found</p>
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>
