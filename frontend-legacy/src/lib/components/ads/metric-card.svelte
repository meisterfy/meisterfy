<script lang="ts">
	import { TrendingUp, TrendingDown, Icon as LucideIcon } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'

	interface Delta {
		pct: string
		dir: 'up' | 'down' | 'flat'
	}

	const {
		icon: Icon,
		theme = 'indigo',
		label,
		value,
		subtitle,
		delta
	} = $props<{
		icon: typeof LucideIcon
		theme?: 'indigo' | 'blue' | 'emerald' | 'amber' | 'rose' | 'slate'
		label: string
		value: string | number
		subtitle?: string
		delta: Delta
	}>()

	const themes = {
		indigo: {
			hover: 'hover:border-indigo-200 dark:hover:border-indigo-800',
			iconBg: 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/30'
		},
		blue: {
			hover: 'hover:border-blue-200 dark:hover:border-blue-800',
			iconBg: 'bg-blue-50 text-blue-500 dark:bg-blue-900/30'
		},
		emerald: {
			hover: 'hover:border-emerald-200 dark:hover:border-emerald-800',
			iconBg: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/30'
		},
		amber: {
			hover: 'hover:border-amber-200 dark:hover:border-amber-800',
			iconBg: 'bg-amber-50 text-amber-500 dark:bg-amber-900/30'
		},
		rose: {
			hover: 'hover:border-rose-200 dark:hover:border-rose-800',
			iconBg: 'bg-rose-50 text-rose-500 dark:bg-rose-900/30'
		},
		slate: {
			hover: 'hover:border-slate-300 dark:hover:border-slate-700',
			iconBg: 'bg-slate-100 text-slate-500 dark:bg-slate-800'
		}
	}

	const t = $derived(themes[theme as keyof typeof themes])
</script>

<div
	class="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors {t.hover} dark:border-slate-800 dark:bg-slate-900"
>
	<div class="relative z-10 mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
		<div class="flex h-8 w-8 items-center justify-center rounded-md {t.iconBg}">
			<Icon class="h-4 w-4" />
		</div>
		{label}
	</div>
	<div class="relative z-10 text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
	{#if subtitle}
		<div class="relative z-10 mt-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
			{subtitle}
		</div>
	{/if}
	{#if delta.dir !== 'flat'}
		<div class="relative z-10 mt-2 flex items-center gap-1">
			{#if delta.dir === 'up'}
				<TrendingUp class="h-3 w-3 text-emerald-500" />
				<span class="text-xs font-bold text-emerald-600 dark:text-emerald-400"
					>{delta.pct} {m['ads:vs_prev_week']()}</span
				>
			{:else}
				<TrendingDown class="h-3 w-3 text-red-400" />
				<span class="text-xs font-bold text-red-500 dark:text-red-400"
					>{delta.pct} {m['ads:vs_prev_week']()}</span
				>
			{/if}
		</div>
	{/if}
</div>
