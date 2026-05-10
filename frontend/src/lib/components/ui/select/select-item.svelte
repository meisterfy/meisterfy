<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui'
	import { cn, type WithoutChild } from '$lib/utils.js'
	import CheckIcon from '@lucide/svelte/icons/check'

	let {
		ref = $bindable(null),
		class: className,
		value,
		label,
		children: childrenProp,
		...restProps
	}: WithoutChild<SelectPrimitive.ItemProps> = $props()
</script>

<SelectPrimitive.Item
	bind:ref
	{value}
	data-slot="select-item"
	class={cn(
		"relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100 data-disabled:pointer-events-none data-disabled:opacity-50 dark:hover:bg-slate-800 dark:focus:bg-slate-800 select-none",
		className
	)}
	{...restProps}
>
	{#snippet children({ selected, highlighted })}
		<span class="absolute inset-e-2 flex size-3.5 items-center justify-center">
			{#if selected}
				<CheckIcon class="cn-select-item-indicator-icon" />
			{/if}
		</span>
		{#if childrenProp}
			{@render childrenProp({ selected, highlighted })}
		{:else}
			{label || value}
		{/if}
	{/snippet}
</SelectPrimitive.Item>
