<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { HTMLAttributes } from 'svelte/elements';

    let {
        class: className = '',
        children,
        ...restProps
    }: HTMLAttributes<HTMLDivElement> & {
        children: Snippet
    } = $props()
</script>

<div class="mx-auto max-w-full w-full lg:w-[1200px] xl:w-[1600px] px-2 lg:px-4 {className}" {...restProps}>
    {@render children()}
</div>