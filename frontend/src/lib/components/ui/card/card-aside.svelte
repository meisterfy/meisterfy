<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { HTMLAttributes } from 'svelte/elements'
	import Card from './card.svelte'

	let {
		title,
		description,
		aside,
		header,
		footer,
		children,
		class: className = '',
		...restProps
	}: {
		title?: string
		description?: string
		aside?: Snippet
		children: Snippet
		header?: Snippet
		footer?: Snippet
		class?: string
	} & HTMLAttributes<HTMLDivElement> = $props()
</script>

<div class="flex flex-col gap-6 lg:flex-row lg:gap-8 {className}" {...restProps}>
	<div class="flex shrink-0 flex-col lg:w-1/3">
		{#if aside}
			{@render aside()}
		{:else}
			{#if title}
				<h2 class="text-text text-base font-semibold">
					{title}
				</h2>
			{/if}
			{#if description}
				<p class="text-text/70 mt-1 text-sm">
					{description}
				</p>
			{/if}
		{/if}
	</div>

	<div class="min-w-0 flex-1">
		<Card {header} {footer}>
			{@render children()}
		</Card>
	</div>
</div>
