<script lang="ts">
	import { untrack } from 'svelte'
	import {
		Bell,
		CheckCircle,
		EyeOff,
		AlertTriangle,
		AlertOctagon,
		Clock,
		Inbox
	} from 'lucide-svelte'
	import type { PageData } from './$types'
	import type { Alert } from '$lib/api/alerts'
	import { resolveAlert, ignoreAlert } from '$lib/api/alerts'

	let { data } = $props<{ data: PageData }>()

	let openAlerts = $state<Alert[]>(untrack(() => data.alerts))
	$effect(() => {
		openAlerts = data.alerts
	})
	let busy = $state(new Set<string>())

	let criticals = $derived(openAlerts.filter((a) => a.level === 'CRITICAL'))
	let warns = $derived(openAlerts.filter((a) => a.level === 'WARN'))

	async function dismiss(id: string, action: 'resolved' | 'ignored') {
		busy = new Set([...busy, id])
		try {
			if (action === 'resolved') {
				await resolveAlert(data.tenant, id)
			} else {
				await ignoreAlert(data.tenant, id)
			}
			openAlerts = openAlerts.filter((a) => a.id !== id)
		} catch {
			// ignore errors — alert stays visible
		} finally {
			const next = new Set(busy)
			next.delete(id)
			busy = next
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		})
	}

	function resolvedLabel(alert: Alert): string {
		if (alert.resolved_at) return 'Resolved'
		if (alert.ignored_at) return 'Ignored'
		return ''
	}

	function isResolved(alert: Alert): boolean {
		return !!(alert.resolved_at || alert.ignored_at)
	}

	function typeLabel(type: string): string {
		const map: Record<string, string> = {
			no_conversions_streak: 'No Conversions',
			high_cpa: 'High CPA',
			budget_underpace: 'Budget Underpace',
			low_impressions: 'Low Impressions'
		}
		return map[type] ?? type
	}
</script>

<div class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- Header -->
	<div class="mb-8">
		<div class="mb-1 flex items-center gap-3">
			<Bell class="h-6 w-6 text-slate-400" />
			<h2 class="text-2xl font-bold text-slate-900 dark:text-white">Alerts</h2>
			{#if openAlerts.length > 0}
				<span
					class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400"
				>
					{openAlerts.length} open
				</span>
			{/if}
		</div>
		<p class="ml-9 text-sm text-slate-500 dark:text-slate-400">
			Automatic alerts from daily monitoring
		</p>
	</div>

	<!-- Empty state -->
	{#if openAlerts.length === 0 && data.history.length === 0}
		<div
			class="rounded-xl border border-dashed border-slate-300 p-16 text-center dark:border-slate-700"
		>
			<Inbox class="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
			<p class="font-medium text-slate-500 dark:text-slate-400">No alerts yet</p>
			<p class="mt-1 text-sm text-slate-400 dark:text-slate-500">
				Daily monitoring populates this inbox automatically.
			</p>
		</div>
	{:else}
		<!-- OPEN ALERTS -->
		{#if openAlerts.length === 0}
			<div
				class="mb-8 rounded-xl border border-dashed border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-900/10"
			>
				<CheckCircle class="mx-auto mb-2 h-8 w-8 text-emerald-400" />
				<p class="text-sm font-medium text-emerald-700 dark:text-emerald-400">
					All clear — no open alerts.
				</p>
			</div>
		{:else}
			<!-- CRITICAL -->
			{#if criticals.length > 0}
				<section class="mb-6">
					<div class="mb-3 flex items-center gap-2">
						<AlertOctagon class="h-4 w-4 text-red-500" />
						<h3 class="text-sm font-bold tracking-wider text-red-600 uppercase dark:text-red-400">
							Critical ({criticals.length})
						</h3>
					</div>
					<div class="flex flex-col gap-3">
						{#each criticals as alert (alert.id)}
							<div
								class="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10"
							>
								<div class="flex items-start justify-between gap-4">
									<div class="min-w-0 flex-1">
										<div class="mb-1 flex flex-wrap items-center gap-2">
											<span
												class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300"
											>
												{typeLabel(alert.type)}
											</span>
											<span class="text-xs text-slate-400 tabular-nums dark:text-slate-500">
												{formatDate(alert.created_at.slice(0, 10))}
											</span>
											<span class="font-mono text-xs text-slate-400 dark:text-slate-500">
												cmp. {alert.campaign_id}
											</span>
										</div>
										<p class="text-sm font-semibold text-red-800 dark:text-red-200">
											{alert.message}
										</p>
										{#if (alert.details as any)?.action_suggested}
											<p class="mt-1 flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
												<span class="mt-0.5 shrink-0">→</span>
												<span>{(alert.details as any).action_suggested}</span>
											</p>
										{/if}
									</div>
									<div class="flex shrink-0 items-center gap-2">
										<button
											onclick={() => dismiss(alert.id, 'resolved')}
											disabled={busy.has(alert.id)}
											class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
										>
											<CheckCircle class="h-3.5 w-3.5" /> Resolve
										</button>
										<button
											onclick={() => dismiss(alert.id, 'ignored')}
											disabled={busy.has(alert.id)}
											class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
										>
											<EyeOff class="h-3.5 w-3.5" /> Ignore
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- WARN -->
			{#if warns.length > 0}
				<section class="mb-6">
					<div class="mb-3 flex items-center gap-2">
						<AlertTriangle class="h-4 w-4 text-amber-500" />
						<h3
							class="text-sm font-bold tracking-wider text-amber-600 uppercase dark:text-amber-400"
						>
							Warning ({warns.length})
						</h3>
					</div>
					<div class="flex flex-col gap-3">
						{#each warns as alert (alert.id)}
							<div
								class="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/10"
							>
								<div class="flex items-start justify-between gap-4">
									<div class="min-w-0 flex-1">
										<div class="mb-1 flex flex-wrap items-center gap-2">
											<span
												class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
											>
												{typeLabel(alert.type)}
											</span>
											<span class="text-xs text-slate-400 tabular-nums dark:text-slate-500">
												{formatDate(alert.created_at.slice(0, 10))}
											</span>
											<span class="font-mono text-xs text-slate-400 dark:text-slate-500">
												cmp. {alert.campaign_id}
											</span>
										</div>
										<p class="text-sm font-semibold text-amber-800 dark:text-amber-200">
											{alert.message}
										</p>
										{#if (alert.details as any)?.action_suggested}
											<p
												class="mt-1 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400"
											>
												<span class="mt-0.5 shrink-0">→</span>
												<span>{(alert.details as any).action_suggested}</span>
											</p>
										{/if}
									</div>
									<div class="flex shrink-0 items-center gap-2">
										<button
											onclick={() => dismiss(alert.id, 'resolved')}
											disabled={busy.has(alert.id)}
											class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
										>
											<CheckCircle class="h-3.5 w-3.5" /> Resolve
										</button>
										<button
											onclick={() => dismiss(alert.id, 'ignored')}
											disabled={busy.has(alert.id)}
											class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
										>
											<EyeOff class="h-3.5 w-3.5" /> Ignore
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}
		{/if}

		<!-- HISTORY -->
		{#if data.history.length > 0}
			<section>
				<div class="mt-2 mb-3 flex items-center gap-2">
					<Clock class="h-4 w-4 text-slate-400" />
					<h3 class="text-sm font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
						History
					</h3>
				</div>
				<div
					class="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
				>
					{#each data.history as alert (alert.id)}
						{@const resolved = isResolved(alert)}
						<div class="flex items-center gap-3 px-4 py-3 {resolved ? 'opacity-50' : ''}">
							<!-- Level dot -->
							<span
								class="h-2 w-2 shrink-0 rounded-full {alert.level === 'CRITICAL'
									? 'bg-red-400'
									: 'bg-amber-400'}"
							></span>

							<!-- Type -->
							<span
								class="w-32 shrink-0 truncate text-xs font-medium text-slate-500 dark:text-slate-400"
							>
								{typeLabel(alert.type)}
							</span>

							<!-- Message -->
							<span class="flex-1 truncate text-xs text-slate-700 dark:text-slate-300"
								>{alert.message}</span
							>

							<!-- Date -->
							<span class="shrink-0 text-xs text-slate-400 tabular-nums dark:text-slate-500">
								{formatDate(alert.created_at.slice(0, 10))}
							</span>

							<!-- Status badge -->
							{#if resolved}
								<span
									class="rounded-full px-2 py-0.5 text-xs {alert.resolved_at
										? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
										: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'} shrink-0"
								>
									{resolvedLabel(alert)}
								</span>
							{:else}
								<span
									class="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400"
								>
									Open
								</span>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>
