<script lang="ts">
	import { Label as LabelPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: ComponentProps<typeof LabelPrimitive.Root> = $props();
</script>

<LabelPrimitive.Root
	bind:ref
	class={cn(
		'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-text',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</LabelPrimitive.Root>
