<script lang="ts">
	import { Check, ChevronDown, X } from 'lucide-svelte'
	import ProviderIcon from '$lib/components/ui/provider-icon.svelte'
	import { BRAND_COLOR, PLATFORM_CONFIG, type PostPlatform } from '$lib/social'

	let {
		value = $bindable<PostPlatform[]>([]),
		placeholder = 'Select platforms…'
	}: {
		value: PostPlatform[]
		placeholder?: string
	} = $props()

	let open = $state(false)
	let container = $state<HTMLDivElement | null>(null)

	const PLATFORM_ORDER: PostPlatform[] = [
		'instagram_feed',
		'instagram_stories',
		'instagram_reels',
		'linkedin',
		'facebook'
	]

	function toggle(val: PostPlatform) {
		value = value.includes(val) ? value.filter((v) => v !== val) : [...value, val]
	}

	function removeChip(val: PostPlatform, e: MouseEvent) {
		e.stopPropagation()
		value = value.filter((v) => v !== val)
	}

	function onOutside(e: MouseEvent) {
		if (container && !container.contains(e.target as Node)) open = false
	}

	$effect(() => {
		if (open) {
			document.addEventListener('mousedown', onOutside)
			return () => document.removeEventListener('mousedown', onOutside)
		}
	})
</script>

<div bind:this={container} class="relative">
	<!-- Trigger (div to avoid nested-button SSR warning) -->
	<div
		role="button"
		aria-expanded={open}
		aria-haspopup="listbox"
		tabindex="0"
		onclick={() => (open = !open)}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				open = !open
			}
		}}
		class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
	>
		<div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
			{#if value.length === 0}
				<span class="text-slate-400">{placeholder}</span>
			{:else}
				{#each value as plt}
					{@const cfg = PLATFORM_CONFIG[plt]}
					<span
						class="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
					>
						<ProviderIcon provider={plt} class="h-3 w-3 shrink-0" style="color: {BRAND_COLOR[plt]}" />
						{cfg?.label ?? plt}
						<button
							type="button"
							onclick={(e) => removeChip(plt, e)}
							class="-mr-0.5 ml-0.5 rounded text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
							aria-label="Remove {cfg?.label}"
						>
							<X class="h-2.5 w-2.5" />
						</button>
					</span>
				{/each}
			{/if}
		</div>
		<ChevronDown
			class="h-4 w-4 shrink-0 text-slate-400 transition-transform {open ? 'rotate-180' : ''}"
		/>
	</div>

	<!-- Dropdown -->
	{#if open}
		<div
			class="absolute top-full left-0 z-50 mt-1 w-full min-w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
		>
			{#each PLATFORM_ORDER as plt}
				{@const cfg = PLATFORM_CONFIG[plt]}
				{@const selected = value.includes(plt)}
				<button
					type="button"
					onclick={() => toggle(plt)}
					class="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 {selected
						? 'bg-indigo-50/60 dark:bg-indigo-900/20'
						: ''}"
				>
					<div
						class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors {selected
							? 'border-indigo-600 bg-indigo-600'
							: 'border-slate-300 dark:border-slate-600'}"
					>
						{#if selected}
							<Check class="h-3 w-3 text-white" />
						{/if}
					</div>
					<ProviderIcon provider={plt} class="h-3.5 w-3.5 shrink-0" style="color: {BRAND_COLOR[plt]}" />
					<span class="text-slate-700 dark:text-slate-300">{cfg?.label ?? plt}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
