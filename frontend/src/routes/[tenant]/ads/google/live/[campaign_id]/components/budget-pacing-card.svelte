<script lang="ts">
	import { Gauge } from 'lucide-svelte'
	import { brl } from '$lib/utils/format'
	
	let { pacing } = $props<{ pacing: { date: string; cost: number; budget: number; pct: number } }>()

	function pacing_color(pct: number): string {
		if (pct > 0.9) return 'bg-emerald-500'
		if (pct > 0.5) return 'bg-amber-400'
		return 'bg-red-400'
	}
</script>

<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
	<div class="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
		<div class="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800">
			<Gauge class="h-4 w-4" />
		</div>
		Budget Pacing —<span class="font-mono text-xs">{pacing.date}</span>
	</div>
	<div class="mb-2 flex items-end justify-between">
		<span class="text-2xl font-bold text-slate-900 dark:text-white">{brl(pacing.cost)}</span>
		<span class="text-sm text-slate-500">of {brl(pacing.budget)}/day</span>
	</div>
	<div class="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
		<div class="h-2 rounded-full transition-all {pacing_color(pacing.pct)}" style="width: {Math.min(pacing.pct * 100, 100).toFixed(0)}%"></div>
	</div>
	<p class="mt-1.5 text-right text-xs text-slate-400">{(pacing.pct * 100).toFixed(0)}% used</p>
</div>
