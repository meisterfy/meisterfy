<script lang="ts">
	import type { Snippet } from "svelte"

	let { children, class: className = '' }: { children: Snippet; class?: string } = $props()
</script>

<div class="prose prose-sm prose-indigo dark:prose-invert prose-p:mb-0 prose-headings:m-0">
    {@render children()}
</div>