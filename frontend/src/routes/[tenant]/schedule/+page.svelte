<script lang="ts">
	import { CalendarClock, CheckCircle2, XCircle, Clock, Terminal, RefreshCw } from 'lucide-svelte'
	import type { PageData } from './$types'
	import type { AgentRun } from '$lib/api/schedule'

	let { data } = $props<{ data: PageData }>()

	function formatTs(ts: string): string {
		return new Date(ts).toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})
	}

	function timeAgo(ts: string): string {
		const diff = Date.now() - new Date(ts).getTime()
		const h = Math.floor(diff / 3_600_000)
		const d = Math.floor(h / 24)
		if (d >= 1) return `${d}d ago`
		if (h >= 1) return `${h}h ago`
		const m = Math.floor(diff / 60_000)
		return `${m}m ago`
	}

	function agentLabel(agent: string): string {
		const map: Record<string, string> = {
			'collect-daily-metrics': 'Daily Metrics',
			'consolidate-monthly': 'Monthly Consolidation',
			'check-alerts': 'Alert Check'
		}
		return map[agent] ?? agent
	}

	// Count campaigns: each appears as "[N] Campaign Name" in output
	function parseCampaigns(output: string | null): string {
		if (!output) return '—'
		const matches = output.match(/\[\d+\]/g)
		return matches ? String(matches.length) : '—'
	}

	// Sum conversions across all campaigns from output
	function parseTotalConversions(output: string | null): string {
		if (!output) return '—'
		const matches = [...output.matchAll(/conv:\s*([\d.]+)/g)]
		if (!matches.length) return '—'
		const total = matches.reduce((s, m) => s + parseFloat(m[1]), 0)
		return total % 1 === 0 ? String(total) : total.toFixed(1)
	}

	const lastRun = $derived(data.lastRun as AgentRun | null)
	const isHealthy = $derived(lastRun?.status === 'success')

	// Hours since last run (for staleness warning)
	const hoursSince = $derived(
		lastRun ? (Date.now() - new Date(lastRun.started_at).getTime()) / 3_600_000 : Infinity
	)
	const isStale = $derived(hoursSince > 26)
</script>

<div class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- Header -->
	<div class="mb-8">
		<div class="mb-1 flex items-center gap-3">
			<CalendarClock class="h-6 w-6 text-slate-400" />
			<h2 class="text-2xl font-bold text-slate-900 dark:text-white">Schedule</h2>
		</div>
		<p class="ml-9 text-sm text-slate-500 dark:text-slate-400">
			Daily monitoring run history and cron setup
		</p>
	</div>

	<!-- Last run status card -->
	<div
		class="mb-6 rounded-xl border {isStale
			? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10'
			: isHealthy
				? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10'
				: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'} p-5"
	>
		<div class="flex items-start gap-4">
			<div class="mt-0.5 shrink-0">
				{#if !lastRun}
					<Clock class="h-6 w-6 text-slate-400" />
				{:else if isStale}
					<RefreshCw class="h-6 w-6 text-amber-500" />
				{:else if isHealthy}
					<CheckCircle2 class="h-6 w-6 text-emerald-500" />
				{:else}
					<XCircle class="h-6 w-6 text-red-500" />
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				{#if !lastRun}
					<p class="font-semibold text-slate-700 dark:text-slate-200">No runs recorded yet</p>
					<p class="mt-0.5 text-sm text-slate-500">
						Run the script manually or configure the cron below.
					</p>
				{:else}
					<div class="flex flex-wrap items-center gap-3">
						<p
							class="font-semibold {isStale
								? 'text-amber-800 dark:text-amber-200'
								: isHealthy
									? 'text-emerald-800 dark:text-emerald-200'
									: 'text-red-800 dark:text-red-200'}"
						>
							{isStale
								? 'Monitoring may be stale'
								: isHealthy
									? 'Last run successful'
									: 'Last run failed'}
						</p>
						<span class="text-xs text-slate-500 tabular-nums"
							>{formatTs(lastRun.started_at)} ({timeAgo(lastRun.started_at)})</span
						>
					</div>
					<div class="mt-2 flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
						<span
							>Campaigns collected: <strong>{parseCampaigns(lastRun.output ?? null)}</strong></span
						>
						<span
							>Total conversions: <strong>{parseTotalConversions(lastRun.output ?? null)}</strong
							></span
						>
					</div>
					{#if lastRun.error}
						<p
							class="mt-2 truncate rounded bg-red-100 px-2 py-1 font-mono text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400"
						>
							{lastRun.error}
						</p>
					{/if}
				{/if}
			</div>
		</div>
	</div>

	<!-- Cron setup card -->
	<div
		class="mb-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
	>
		<div class="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
			<Terminal class="h-4 w-4" /> Cron setup (WSL crontab)
		</div>
		<pre
			class="overflow-x-auto rounded-lg bg-slate-50 px-4 py-3 font-mono text-xs break-all whitespace-pre-wrap text-slate-700 dark:bg-slate-800 dark:text-slate-300">{data.cronCommand}</pre>
		<p class="mt-2 text-xs text-slate-400">
			Runs daily at 07:03 — after Google Ads closes the previous day's stats (~6h delay).
		</p>
	</div>

	<!-- Run history -->
	{#if data.runs.length === 0}
		<div
			class="rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700"
		>
			<Clock class="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
			<p class="text-sm text-slate-500 dark:text-slate-400">No run history yet.</p>
		</div>
	{:else}
		<div
			class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
		>
			<div
				class="border-b border-slate-200 bg-slate-50/50 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/20"
			>
				<h3 class="text-sm font-bold tracking-wider text-slate-700 uppercase dark:text-slate-200">
					Run History — last {data.runs.length} entries
				</h3>
			</div>
			<div class="divide-y divide-slate-100 dark:divide-slate-800">
				{#each data.runs as run (run.id)}
					<div class="flex items-center gap-3 px-5 py-3">
						<!-- Status dot -->
						<span
							class="h-2 w-2 shrink-0 rounded-full {run.status === 'success'
								? 'bg-emerald-400'
								: 'bg-red-400'}"
						></span>

						<!-- Agent -->
						<span
							class="w-36 shrink-0 truncate text-xs font-medium text-slate-600 dark:text-slate-400"
						>
							{agentLabel(run.agent)}
						</span>

						<!-- Date collected -->
						<span class="w-24 shrink-0 font-mono text-xs text-slate-500 dark:text-slate-500">
							{run.date}
						</span>

						<!-- Output summary -->
						<span class="flex-1 truncate text-xs text-slate-600 dark:text-slate-400">
							{#if run.status === 'success'}
								{parseCampaigns(run.output ?? null)} campaigns · {parseTotalConversions(
									run.output ?? null
								)} conv
							{:else}
								<span class="text-red-500">{run.error ?? 'error'}</span>
							{/if}
						</span>

						<!-- Timestamp -->
						<span class="shrink-0 text-xs text-slate-400 tabular-nums dark:text-slate-500">
							{formatTs(run.started_at)}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
