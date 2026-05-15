<script lang="ts">
	import { Chart, registerables } from 'chart.js'
	import type { DeviceRow } from '$lib/api/campaigns'

	Chart.register(...registerables)

	let { devices } = $props<{ devices: DeviceRow[] }>()

	const DEVICE_COLORS: Record<string, string> = {
		DESKTOP: '#3b82f6',
		MOBILE: '#22c55e',
		TABLET: '#f59e0b',
	}

	const deviceLabel = (d: string) =>
		d === 'DESKTOP' ? 'Desktop' : d === 'MOBILE' ? 'Mobile' : 'Tablet'

	const donutConfig = $derived(() => ({
		type: 'doughnut' as const,
		data: {
			labels: devices.map((d: DeviceRow) => deviceLabel(d.device)),
			datasets: [
				{
					data: devices.map((d: DeviceRow) => d.cost),
					backgroundColor: devices.map((d: DeviceRow) => DEVICE_COLORS[d.device] ?? '#94a3b8'),
					borderWidth: 0,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { position: 'bottom' as const },
				tooltip: {
					callbacks: {
						label: (ctx: any) => ` R$${ctx.parsed.toFixed(2)}`,
					},
				},
			},
		},
	}))

	const cpaDevices = $derived(devices.filter((d: DeviceRow) => d.conversions > 0).sort((a: DeviceRow, b: DeviceRow) => a.cpa - b.cpa))

	let canvas = $state<HTMLCanvasElement | undefined>()
	let instance: Chart<any> | null = null

	$effect(() => {
		if (!canvas || devices.length === 0) return
		instance?.destroy()
		instance = new Chart(canvas, donutConfig())
		return () => {
			instance?.destroy()
			instance = null
		}
	})
</script>

<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
	<div>
		<h3 class="text-lg font-bold text-slate-900 dark:text-white">Performance by Device</h3>
		<p class="text-xs text-slate-400 mt-0.5">Use to inform device bid adjustments</p>
	</div>

	{#if devices.length === 0}
		<p class="py-8 text-center text-sm text-slate-400">No device data available</p>
	{:else}
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<div>
				<p class="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">Cost Share</p>
				<div class="h-[220px]">
					<canvas bind:this={canvas}></canvas>
				</div>
			</div>

			{#if cpaDevices.length > 0}
				<div>
					<p class="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">CPA by Device</p>
					<div class="space-y-3">
						{#each cpaDevices as d}
							{@const maxCpa = cpaDevices[cpaDevices.length - 1].cpa}
							<div class="space-y-1">
								<div class="flex justify-between text-xs text-slate-600 dark:text-slate-300">
									<span>{deviceLabel(d.device)}</span>
									<span class="font-semibold">R${d.cpa.toFixed(2)}</span>
								</div>
								<div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
									<div
										class="h-2 rounded-full transition-all"
										style="width: {maxCpa > 0 ? ((d.cpa / maxCpa) * 100).toFixed(1) : 0}%; background: {DEVICE_COLORS[d.device] ?? '#94a3b8'}"
									></div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
