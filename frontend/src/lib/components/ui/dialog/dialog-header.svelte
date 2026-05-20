<script lang="ts">
	import type { Snippet } from 'svelte'

	let {
		class: className = '',
		children
	}: { class?: string; children?: Snippet } = $props()
</script>

<div class="flex flex-col gap-1.5 px-6 pt-6 pb-4 {className}">
	{@render children?.()}
</div>
