<script lang="ts">
	import type { Snippet } from 'svelte'

	let {
		title,
		icon,
		children
	}: {
		title: string
		icon?: Snippet
		children?: Snippet
	} = $props()
</script>

<div class="flex flex-col lg:flex-row items-center justify-between gap-2 lg:gap-4 mt-4 lg:mt-8 pb-4 border-b border-primary/5">
	<div class="flex items-end gap-2 lg:gap-4">
		{#if icon}
            <div class="bg-primary/5 dark:bg-white/5 rounded-md p-2 flex items-center justify-center">
    			{@render icon()}
            </div>
		{/if}
		<h2 class="text-text-base text-lg lg:text-3xl xl:text-4xl font-semibold lg:-mb-0.5">
            {title}
        </h2>
	</div>
	{#if children}
        <div>
            {@render children()}
        </div>
	{/if}
</div>