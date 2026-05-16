<script lang="ts">
	import { Chart, registerables } from 'chart.js'
	import type { HourlyRow } from '$lib/api/campaigns'

	Chart.register(...registerables)

	let { hourly } = $props<{ hourly: HourlyRow[] }>()

	const hasConversions = $derived(hourly.some((h: HourlyRow) => h.conversions > 0))

	function top3Indices(rows: HourlyRow[]) {
		return [...rows]
			.map((r, i) => ({ i, v: r.conversions }))
			.sort((a, b) => b.v - a.v)
			.slice(0, 3)
			.map((x) => x.i)
	}

	const chartConfig = $derived(() => {
		const top3 = top3Indices(hourly)
		return {
			type: 'bar' as const,
			data: {
				labels: hourly.map((h: HourlyRow) => `${h.hour}h`),
				datasets: [
					{
						label: 'Conversions',
						data: hourly.map((h: HourlyRow) => h.conversions),
						backgroundColor: hourly.map((_: HourlyRow, i: number) =>
							top3.includes(i) ? '#10b981' : '#6366f1'
						),
						yAxisID: 'y',
						order: 2
					},
					{
						label: 'Cost (R$)',
						data: hourly.map((h: HourlyRow) => h.cost),
						type: 'line' as const,
						borderColor: '#f59e0b',
						backgroundColor: 'transparent',
						pointRadius: 0,
						borderWidth: 1.5,
						yAxisID: 'y1',
						order: 1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { position: 'bottom' as const }
				},
				scales: {
					y: {
						type: 'linear' as const,
						position: 'left' as const,
						title: { display: true, text: 'Conversions' }
					},
					y1: {
						type: 'linear' as const,
						position: 'right' as const,
						title: { display: true, text: 'Cost (R$)' },
						grid: { drawOnChartArea: false }
					}
				}
			}
		}
	})

	let canvas = $state<HTMLCanvasElement | undefined>()
	let instance: Chart | null = null

	$effect(() => {
		if (!canvas) return
		instance?.destroy()
		instance = new Chart(canvas, chartConfig())
		return () => {
			instance?.destroy()
			instance = null
		}
	})
</script>

<div
	class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
>
	<div>
		<h3 class="text-lg font-bold text-slate-900 dark:text-white">
			Hourly Performance Distribution
		</h3>
		<p class="mt-0.5 text-xs text-slate-400">Top hours highlighted in green</p>
	</div>

	{#if !hasConversions}
		<p class="py-8 text-center text-sm text-slate-400">No conversion data for this period</p>
	{:else}
		<div class="h-[260px]">
			<canvas bind:this={canvas}></canvas>
		</div>
	{/if}
</div>
