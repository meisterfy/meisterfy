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
	<div class="lg:w-1/3 shrink-0 flex flex-col">
		{#if aside}
			{@render aside()}
		{:else}
			{#if title}
				<h2 class="text-base font-semibold text-text">
                    {title}
                </h2>
			{/if}
			{#if description}
				<p class="mt-1 text-sm text-text/70">
                    {description}
                </p>
			{/if}
		{/if}
	</div>

	<div class="flex-1 min-w-0">
		<Card {header} {footer}>
			{@render children()}
		</Card>
	</div>
</div>
