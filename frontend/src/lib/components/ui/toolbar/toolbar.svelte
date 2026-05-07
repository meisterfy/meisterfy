<script lang="ts">
	import type { Snippet } from 'svelte'

	let { header, mobileMenu }: { header: Snippet; mobileMenu?: Snippet } = $props()
</script>

<header
	class="sticky top-0 z-50 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 print:hidden"
>
	<div class="px-4 lg:px-6">
		<div class="flex h-16 items-center justify-between">
			{@render header()}
		</div>
	</div>
	{#if mobileMenu}
		{@render mobileMenu()}
	{/if}
</header>