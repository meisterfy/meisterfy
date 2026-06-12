<script lang="ts">
	import { Shield, FileJson } from 'lucide-svelte'
	import { getAuditLog } from '$lib/api/audit-log'
	import type { AuditEntry, AuditLogResponse } from '$lib/api/audit-log'
	import { m } from '$lib/paraglide/messages'
	import type { PageData } from './$types'
	import SettingsSkeleton from '../settings-skeleton.svelte'
	import SectionTitle from '$lib/components/ui/title/section-title.svelte'
	import DataTable from '$lib/components/ui/data-table/data-table.svelte'
	import { renderSnippet } from '$lib/components/ui/data-table/index.js'
	import type { ColumnDef } from '@tanstack/table-core'
	import { Button } from '$lib/components/ui/button/index.js'
	import Drawer from '$lib/components/ui/drawer/drawer.svelte'
	import { getDiffs } from '$lib/utils/diff'

	let { data } = $props<{ data: PageData }>()

	const PAGE_SIZE = 50

	const ENTITY_TYPES = ['', 'post', 'tenant', 'user', 'integration']

	let entries = $state<AuditEntry[]>([])
	let total = $state(0)
	let offset = $state(0)

	let initialLoading = $state(true)
	$effect(() => {
		initialLoading = true
		data.auditLog.then((log: AuditLogResponse) => {
			entries = log.data
			total = log.total
			initialLoading = false
		})
	})
	let loading = $state(false)

	let filterEntityType = $state('')
	let filterUserId = $state('')

	let selectedEntry = $state<AuditEntry | null>(null)
	let showDrawer = $state(false)

	async function load(newOffset = 0) {
		loading = true
		offset = newOffset
		const res = await getAuditLog(data.tenant, {
			limit: PAGE_SIZE,
			offset: newOffset,
			entity_type: filterEntityType || undefined,
			user_id: filterUserId.trim() || undefined
		}).catch(() => ({ data: [], total: 0 }))
		entries = res.data
		total = res.total
		loading = false
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleString('en-GB', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})
	}

	const totalPages = $derived(Math.ceil(total / PAGE_SIZE))
	const currentPage = $derived(Math.floor(offset / PAGE_SIZE) + 1)

	let columns = $derived<ColumnDef<AuditEntry, unknown>[]>([
		{
			id: 'time',
			header: m['settings:audit_col_time'](),
			cell: ({ row }) => renderSnippet(timeCell, { entry: row.original })
		},
		{
			id: 'user',
			header: m['settings:audit_col_user'](),
			cell: ({ row }) => row.original.user_name || row.original.user_id
		},
		{
			id: 'action',
			header: m['settings:audit_col_action'](),
			cell: ({ row }) => renderSnippet(actionCell, { entry: row.original })
		},
		{
			id: 'entity',
			header: m['settings:audit_col_entity'](),
			cell: ({ row }) => renderSnippet(entityCell, { entry: row.original })
		},
		{
			id: 'actions',
			header: '',
			cell: ({ row }) => renderSnippet(actionsCell, { entry: row.original })
		}
	])
</script>

{#snippet timeCell({ entry }: { entry: AuditEntry })}
	<span class="text-muted-foreground font-mono text-xs whitespace-nowrap">
		{formatDate(entry.created_at)}
	</span>
{/snippet}

{#snippet actionCell({ entry }: { entry: AuditEntry })}
	<span class="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{entry.action}</span>
{/snippet}

{#snippet entityCell({ entry }: { entry: AuditEntry })}
	<span class="text-muted-foreground text-xs">{entry.entity_type}</span>
	{#if entry.entity_name}
		<span class="ml-1">{entry.entity_name}</span>
	{:else}
		<span class="text-muted-foreground ml-1 font-mono text-xs">{entry.entity_id}</span>
	{/if}
{/snippet}

{#snippet actionsCell({ entry }: { entry: AuditEntry })}
	{@const hasBefore = entry.before != null && Object.keys(entry.before).length > 0}
	{@const diffs = hasBefore
		? getDiffs(entry.before as Record<string, unknown>, entry.after as Record<string, unknown>)
		: []}
	{#if diffs.length > 0 && !entry.action.endsWith('.created')}
		<div class="flex justify-end">
			<Button
				variant="outline"
				class="h-7 px-2 text-xs"
				onclick={() => {
					selectedEntry = entry
					showDrawer = true
				}}
			>
				<FileJson class="mr-1 h-3.5 w-3.5" /> Details
			</Button>
		</div>
	{/if}
{/snippet}

{#snippet toolbar()}
	<div class="flex flex-wrap gap-3">
		<select
			class="border-border bg-background h-9 rounded-md border px-3 text-sm focus:ring-indigo-500"
			bind:value={filterEntityType}
			onchange={() => load(0)}
		>
			{#each ENTITY_TYPES as t (t)}
				<option value={t}>{t === '' ? m['settings:audit_filter_all_types']() : t}</option>
			{/each}
		</select>

		<input
			class="border-border bg-background h-9 rounded-md border px-3 text-sm focus:ring-indigo-500 focus:outline-none"
			placeholder={m['settings:audit_filter_user_placeholder']()}
			bind:value={filterUserId}
			onkeydown={(e) => e.key === 'Enter' && load(0)}
		/>

		<Button onclick={() => load(0)} class="h-9">
			{m['settings:audit_filter_apply']()}
		</Button>
	</div>
{/snippet}

{#if initialLoading}
	<SettingsSkeleton rows={8} />
{:else}
	<div class="flex flex-col gap-6 p-6">
		<SectionTitle title={m['settings:audit_title']()}>
			{#snippet icon()}
				<Shield class="text-muted-foreground h-5 w-5" />
			{/snippet}
		</SectionTitle>

		<DataTable data={entries} {columns} {toolbar} isLoading={loading} />

		<!-- pagination -->
		{#if totalPages > 1}
			<div class="border-border flex items-center justify-between border-t pt-4">
				<p class="text-muted-foreground text-sm">
					{m['settings:audit_pagination']({ page: currentPage, total: totalPages })}
				</p>
				<div class="flex gap-2">
					<Button
						variant="outline"
						disabled={offset === 0 || loading}
						onclick={() => load(offset - PAGE_SIZE)}
					>
						{m['globals:previous']()}
					</Button>
					<Button
						variant="outline"
						disabled={offset + PAGE_SIZE >= total || loading}
						onclick={() => load(offset + PAGE_SIZE)}
					>
						{m['globals:next']()}
					</Button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<!-- Drawer for Details -->
<Drawer bind:open={showDrawer}>
	<div class="flex h-full flex-col">
		<div class="border-border flex items-center justify-between border-b px-6 py-4">
			<h2 class="text-lg font-bold text-slate-900 dark:text-white">
				{m['settings:audit_details_title']()}
			</h2>
			<Button onclick={() => (showDrawer = false)} variant="outline" class="h-8 px-3 text-xs">
				Close
			</Button>
		</div>

		{#if selectedEntry}
			{@const diffs = getDiffs(
				selectedEntry.before as Record<string, unknown>,
				selectedEntry.after as Record<string, unknown>
			)}
			<div class="flex-1 space-y-6 overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950">
				<div
					class="border-border grid grid-cols-2 gap-4 rounded-lg border bg-white p-4 text-sm shadow-sm dark:bg-slate-900"
				>
					<div>
						<p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Time</p>
						<p class="mt-0.5 font-medium">{formatDate(selectedEntry.created_at)}</p>
					</div>
					<div>
						<p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
							Action
						</p>
						<p class="bg-muted mt-1 w-fit rounded px-1.5 py-0.5 font-mono text-xs">
							{selectedEntry.action}
						</p>
					</div>
					<div>
						<p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">User</p>
						<p class="mt-0.5 font-medium">{selectedEntry.user_name || selectedEntry.user_id}</p>
					</div>
					<div>
						<p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
							Entity
						</p>
						<p class="mt-0.5 font-medium">
							<span class="text-muted-foreground mr-1 text-xs">{selectedEntry.entity_type}</span>
							{selectedEntry.entity_name || selectedEntry.entity_id}
						</p>
					</div>
				</div>

				<div class="flex flex-col gap-4">
					{#if diffs.length === 0}
						<div
							class="text-muted-foreground border-border rounded-lg border bg-white p-6 text-center dark:bg-slate-900"
						>
							{m['settings:audit_details_no_changes']()}
						</div>
					{:else}
						{#each diffs as diff (diff.key)}
							<div
								class="border-border flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-slate-900"
							>
								<div class="bg-muted/50 border-border border-b px-3 py-2">
									<span class="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300"
										>{diff.key}</span
									>
								</div>
								<div class="divide-border grid grid-cols-1 divide-y">
									{#if diff.oldVal !== undefined}
										<div class="flex items-start gap-3 bg-rose-50/50 p-3 dark:bg-rose-950/20">
											<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500"></span>
											<pre
												class="m-0 overflow-x-auto font-mono text-xs text-slate-600 line-through opacity-80 dark:text-slate-400">{JSON.stringify(
													diff.oldVal,
													null,
													2
												)}</pre>
										</div>
									{/if}
									{#if diff.newVal !== undefined}
										<div class="flex items-start gap-3 bg-emerald-50/50 p-3 dark:bg-emerald-950/20">
											<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500"></span>
											<pre
												class="m-0 overflow-x-auto font-mono text-xs text-slate-800 dark:text-slate-200">{JSON.stringify(
													diff.newVal,
													null,
													2
												)}</pre>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{/if}
	</div>
</Drawer>
