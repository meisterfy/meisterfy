<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		children,
		header,
		footer,
		class: className = '',
		...restProps
	}: {
		children?: Snippet;
		header?: Snippet;
		footer?: Snippet;
		class?: string;
	} & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
	class="bg-bg-light text-text border border-border flex flex-col overflow-hidden rounded-xl {className}"
	{...restProps}
>
	<!-- Header Slot -->
	{#if header}
		<div class="p-4 border-b border-border/30">
			{@render header()}
		</div>
	{/if}

	<!-- Body / Content Slot -->
	{#if children}
		<div class="p-4 flex-1">
			{@render children()}
		</div>
	{/if}

	<!-- Footer Slot -->
	{#if footer}
		<div class="p-4 mt-auto">
			{@render footer()}
		</div>
	{/if}
</div>
