<script lang="ts">
	import type { Snippet } from 'svelte'

	let { children }: { children: Snippet } = $props()
</script>

<div class="prose prose-sm prose-indigo dark:prose-invert prose-p:mb-0 prose-headings:m-0">
	{@render children()}
</div>
