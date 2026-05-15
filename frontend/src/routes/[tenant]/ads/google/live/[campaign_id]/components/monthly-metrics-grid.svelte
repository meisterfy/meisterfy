<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import { CalendarDays } from 'lucide-svelte'
	import { brl } from '$lib/utils/format'

	let { metrics } = $props<{ 
		metrics: { totalCost: number; totalConversions: number; daysActive: number; avgCpa: number } 
	}>()
</script>

<div>
	<div class="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
		<div class="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800">
			<CalendarDays class="h-4 w-4" />
		</div>
		{m['ads:dates.month_to_date']()}
	</div>
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
		<div>
			<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
				{m['ads:total_cost']()}
			</p>
			<p class="text-xl font-bold text-slate-900 dark:text-white">
				{brl(metrics.totalCost)}
			</p>
		</div>
		<div>
			<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
				{m['ads:conversions']()}
			</p>
			<p class="text-xl font-bold text-slate-900 dark:text-white">
				{metrics.totalConversions}
			</p>
		</div>
		<div>
			<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
				{m['ads:labels.active_days']()}
			</p>
			<p class="text-xl font-bold text-slate-900 dark:text-white">
				{metrics.daysActive}
			</p>
		</div>
		<div>
			<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
				{m['ads:cpa']()}
			</p>
			<p class="text-xl font-bold text-slate-900 dark:text-white">
				{metrics.avgCpa > 0 ? brl(metrics.avgCpa) : '—'}
			</p>
		</div>
	</div>
</div>
