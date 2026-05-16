<script lang="ts">
	import { Chart, registerables, type ChartConfiguration } from 'chart.js'
	import { Icon as LucideIcon } from 'lucide-svelte'

	Chart.register(...registerables)

	const {
		config,
		title,
		source,
		note,
		icon: Icon
	} = $props<{
		config: ChartConfiguration
		title?: string
		source?: string
		note?: string
		icon?: typeof LucideIcon
	}>()

	let canvas = $state<HTMLCanvasElement | undefined>()
	let instance: Chart | null = null

	$effect(() => {
		if (!canvas) return
		instance?.destroy()
		instance = new Chart(canvas, config)
		return () => {
			instance?.destroy()
			instance = null
		}
	})
</script>

<div
	class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
>
	{#if title}
		<h3
			class="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white {note
				? 'mb-1'
				: 'mb-6'}"
		>
			{#if Icon}<Icon class="h-5 w-5 text-indigo-500" />{/if}
			{title}
			{#if source}
				<span class="ml-auto text-xs font-normal text-slate-400">{source}</span>
			{/if}
		</h3>
	{/if}
	{#if note}
		<p class="mb-5 ml-7 text-xs text-slate-400">{note}</p>
	{/if}
	<div class="h-[280px] w-full">
		<canvas bind:this={canvas}></canvas>
	</div>
</div>
