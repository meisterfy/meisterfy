<script lang="ts">
	import type { Snippet } from 'svelte'

	let {
		class: className = '',
		children
	}: { class?: string; children?: Snippet } = $props()
</script>

<div class="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800 {className}">
	{@render children?.()}
</div>
