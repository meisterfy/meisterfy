<script lang="ts">
	import type { Snippet } from 'svelte'

	let { title, description, children } = $props<{
		title: string
		description?: string
		children: Snippet
	}>()
</script>

<section class="mb-12">
	<div class="mb-6">
		<h2 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
			{title}
		</h2>
		{#if description}
			<p class="text-sm text-slate-500">
				{description}
			</p>
		{/if}
	</div>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
		{@render children()}
	</div>
</section>
