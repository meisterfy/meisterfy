<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	let {
		children,
		class: className,
		variant = 'default',
		...restProps
	}: {
		children?: Snippet;
		class?: string;
		variant?: 'default' | 'destructive';
		[key: string]: any;
	} = $props();

	const variants = {
		default: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50',
		destructive: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
	};
</script>

<div
	role="alert"
	class={cn('rounded-lg px-3 py-2 text-sm font-medium', variants[variant], className)}
	{...restProps}
>
	{@render children?.()}
</div>
