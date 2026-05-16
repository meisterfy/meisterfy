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

<div
	class="border-primary/5 mt-4 flex flex-col items-center justify-between gap-2 border-b pb-4 lg:mt-8 lg:flex-row lg:gap-4"
>
	<div class="flex items-end gap-2 lg:gap-4">
		{#if icon}
			<div class="bg-primary/5 flex items-center justify-center rounded-md p-2 dark:bg-white/5">
				{@render icon()}
			</div>
		{/if}
		<h2 class="text-text-base text-lg font-semibold lg:-mb-0.5 lg:text-3xl xl:text-4xl">
			{title}
		</h2>
	</div>
	{#if children}
		<div>
			{@render children()}
		</div>
	{/if}
</div>
