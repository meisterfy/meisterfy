<script lang="ts">
	import type { Component } from 'svelte'
	import { Icon as LucideIcon } from 'lucide-svelte'
	import type { IconProps } from 'lucide-svelte'

	let {
		href,
		onclick,
		variant = 'default',
		icon: Icon,
		label,
		title,
		class: className = ''
	} = $props<{
		href?: string
		onclick?: (e: MouseEvent) => void
		variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'badge'
		icon?: typeof LucideIcon | Component<IconProps>
		label?: string
		title?: string
		class?: string
	}>()

	const base =
		'inline-flex items-center justify-center gap-1.5 transition-colors text-xs font-medium rounded-md h-8'

	const padding = $derived(label ? 'px-3' : 'px-2')

	const variants: Record<string, string> = {
		default:
			'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800',
		primary: 'text-slate-50 bg-slate-500/10 border border-slate-500/20 hover:bg-slate-500/20',
		secondary:
			'bg-slate-500/10 border border-slate-500/20 text-slate-700 dark:text-slate-200 hover:bg-slate-500/20',
		danger: 'border border-red-400/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10',
		ghost: 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200',
		badge: 'h-5 px-2 rounded-full text-[10px] font-bold uppercase tracking-wide'
	}

	const classes = $derived(
		`${base} ${padding} ${variants[variant] || variants.default} ${className}`
	)
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a {href} class={classes} {title}>
		{#if Icon}<Icon class={variant === 'badge' ? 'h-3 w-3' : 'h-4 w-4'} />{/if}
		{#if label}<span>{label}</span>{/if}
	</a>
{:else if variant === 'badge'}
	<span class={classes}>
		{#if Icon}<Icon class="h-3 w-3" />{/if}
		{#if label}{label}{/if}
	</span>
{:else}
	<button type="button" {onclick} class={classes} {title}>
		{#if Icon}<Icon class="h-4 w-4" />{/if}
		{#if label}<span>{label}</span>{/if}
	</button>
{/if}
