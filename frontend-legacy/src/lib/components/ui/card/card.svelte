<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		children,
		header,
		footer,
		class: className = '',
		...restProps
	}: {
		children?: Snippet
		header?: Snippet
		footer?: Snippet
		class?: string
	} & HTMLAttributes<HTMLDivElement> = $props()
</script>

<div
	class="bg-bg-light text-text border-border flex flex-col overflow-hidden rounded-xl border {className}"
	{...restProps}
>
	<!-- Header Slot -->
	{#if header}
		<div class="border-border/30 border-b p-4">
			{@render header()}
		</div>
	{/if}

	<!-- Body / Content Slot -->
	{#if children}
		<div class="flex-1 p-4">
			{@render children()}
		</div>
	{/if}

	<!-- Footer Slot -->
	{#if footer}
		<div class="mt-auto p-4">
			{@render footer()}
		</div>
	{/if}
</div>
