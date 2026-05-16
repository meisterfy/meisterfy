<script lang="ts">
	import type { Component } from 'svelte'
	import { Icon as LucideIcon } from 'lucide-svelte'
	import type { IconProps } from 'lucide-svelte'

	let {
		variant = 'default',
		icon: Icon,
		label,
		class: className = ''
	} = $props<{
		variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
		icon?: typeof LucideIcon | Component<IconProps>
		label?: string
		class?: string
	}>()

	const variants: Record<string, string> = {
		default: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
		success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
		warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
		error: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
		info: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
		neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
	}

	const classes = $derived(
		`inline-flex items-center ${label ? 'px-2 py-1' : 'p-2'} gap-1 border border-white/5 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0 ${variants[variant] || variants.default} ${className}`
	)
</script>

<span class={classes}>
	{#if Icon}
		<Icon class="h-3 w-3" />
	{/if}
	{#if label}
		{label}
	{/if}
</span>
