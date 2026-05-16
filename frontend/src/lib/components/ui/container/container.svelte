<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		class: className = '',
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		children: Snippet
	} = $props()
</script>

<div
	class="mx-auto w-full max-w-full px-2 lg:w-[1200px] lg:px-4 xl:w-[1600px] {className}"
	{...restProps}
>
	{@render children()}
</div>
