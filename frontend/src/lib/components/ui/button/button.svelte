<script lang="ts">
	import { Button as ButtonPrimitive } from 'bits-ui'
	import { cn } from '$lib/utils'
	import type { ComponentProps } from 'svelte'

	type Variant = 'default' | 'outline' | 'red' | 'transparent'

	let {
		ref = $bindable(null),
		class: className,
		variant = 'default',
		children,
		...restProps
	}: ComponentProps<typeof ButtonPrimitive.Root> & { variant?: Variant } = $props()

	const variantClasses: Record<Variant, string> = {
		default: 'bg-indigo-600 text-white hover:bg-indigo-700',
		outline: 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
		transparent: 'text-text border border-transparent hover:border-border',
		red: 'border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20'
	}
</script>

<ButtonPrimitive.Root
	bind:ref
	class={cn(
		'inline-flex items-center gap-2 justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
		variantClasses[variant],
		className
	)}
	{...restProps}
>
	{@render children?.()}
</ButtonPrimitive.Root>
