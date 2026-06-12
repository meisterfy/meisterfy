<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import { CheckCircle, XCircle, LoaderCircle } from 'lucide-svelte'
	import ConfirmDialog from '$lib/components/ui/dialog/confirm-dialog.svelte'
	import type { PageData } from './$types'
	import type { PendingAdjustment } from '$lib/api/pending-adjustments'
	import { approvePendingAdjustment, rejectPendingAdjustment } from '$lib/api/pending-adjustments'

	let { data } = $props<{ data: PageData }>()

	let suggestions = $state<PendingAdjustment[]>([])
	let loadError = $state(false)

	$effect(() => {
		data.pendingAdjustments
			.then((items: PendingAdjustment[]) => {
				suggestions = items
			})
			.catch(() => {
				loadError = true
			})
	})

	let approveDialogOpen = $state(false)
	let rejectDialogOpen = $state(false)
	let activeId = $state<string | null>(null)
	let processingOp = $state<{ type: 'approve' | 'reject'; id: string } | null>(null)

	function openApprove(id: string) {
		activeId = id
		approveDialogOpen = true
	}

	function openReject(id: string) {
		activeId = id
		rejectDialogOpen = true
	}

	async function doApprove() {
		if (!activeId) return
		const id = activeId
		approveDialogOpen = false
		processingOp = { type: 'approve', id }
		try {
			await approvePendingAdjustment(data.tenant, id)
			suggestions = suggestions.filter((s) => s.id !== id)
		} catch {
			// leave card in place on failure
		} finally {
			processingOp = null
		}
	}

	async function doReject() {
		if (!activeId) return
		const id = activeId
		rejectDialogOpen = false
		processingOp = { type: 'reject', id }
		try {
			await rejectPendingAdjustment(data.tenant, id)
			suggestions = suggestions.filter((s) => s.id !== id)
		} catch {
			// leave card in place on failure
		} finally {
			processingOp = null
		}
	}

	function pctDiff(current: number, proposed: number): number {
		if (current === 0) return 0
		return Math.round(Math.abs(((proposed - current) / current) * 100))
	}

	function badgeLabel(adj: PendingAdjustment): string {
		const pct = pctDiff(adj.current_value, adj.proposed_value)
		switch (adj.adjustment_type) {
			case 'bid_increase':
				return `↑ Bid +${pct}%`
			case 'bid_decrease':
				return `↓ Bid −${pct}%`
			case 'budget_increase':
				return `↑ Budget +${pct}%`
			case 'budget_decrease':
				return `↓ Budget −${pct}%`
		}
	}

	function isIncrease(adj: PendingAdjustment): boolean {
		return adj.adjustment_type === 'bid_increase' || adj.adjustment_type === 'budget_increase'
	}
</script>

<div class="mx-auto w-full max-w-full px-4 py-8 sm:px-6 lg:w-[1200px] lg:px-8">
	<h2 class="mb-6 text-xl font-bold text-slate-900 lg:text-2xl dark:text-white">
		{m['ads:alerts.page_title']()}
	</h2>

	{#if loadError}
		<div
			class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
		>
			{m['ads:alerts.error_load']()}
		</div>
	{:else if suggestions.length > 0}
		<div>
			<h3 class="mb-3 text-base font-semibold text-slate-800 dark:text-slate-200">
				{m['ads:alerts.title']()}
			</h3>
			<div class="flex flex-col gap-3">
				{#each suggestions as adj (adj.id)}
					<div
						class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
					>
						<div class="flex items-start justify-between gap-4">
							<div class="flex min-w-0 flex-col gap-1.5">
								<!-- campaign name is not in the response; showing fallback for future improvement -->
								<span class="text-sm font-medium text-slate-900 dark:text-white">
									{m['ads:alerts.campaign_adjustment']()}
								</span>
								<span
									class="inline-block w-fit rounded-md px-2 py-0.5 text-xs font-semibold {isIncrease(
										adj
									)
										? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
										: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}"
								>
									{badgeLabel(adj)}
								</span>
								<p class="text-sm text-slate-500 dark:text-slate-400">{adj.reason}</p>
							</div>
							<div class="flex shrink-0 items-center gap-2">
								<button
									onclick={() => openReject(adj.id)}
									disabled={processingOp !== null}
									class="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
								>
									{#if processingOp?.id === adj.id && processingOp?.type === 'reject'}
										<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
									{:else}
										<XCircle class="h-3.5 w-3.5" />
									{/if}
									{m['ads:alerts.ignore']()}
								</button>
								<button
									onclick={() => openApprove(adj.id)}
									disabled={processingOp !== null}
									class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
								>
									{#if processingOp?.id === adj.id && processingOp?.type === 'approve'}
										<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
									{:else}
										<CheckCircle class="h-3.5 w-3.5" />
									{/if}
									{m['ads:alerts.approve']()}
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<ConfirmDialog
	bind:open={approveDialogOpen}
	title={m['ads:alerts.approve_confirm_title']()}
	description={m['ads:alerts.approve_confirm_desc']()}
	confirmLabel={m['ads:alerts.approve']()}
	onconfirm={doApprove}
/>

<ConfirmDialog
	bind:open={rejectDialogOpen}
	title={m['ads:alerts.ignore_confirm_title']()}
	description={m['ads:alerts.ignore_confirm_desc']()}
	confirmLabel={m['ads:alerts.ignore']()}
	onconfirm={doReject}
/>
