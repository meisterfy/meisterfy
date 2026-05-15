<script lang="ts">
	import { untrack } from 'svelte'
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
	let total   = $state(0)
	let offset  = $state(0)

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
	let filterUserId     = $state('')

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
		total   = res.total
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

	let columns = $derived<ColumnDef<AuditEntry, any>[]>([
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
	{@const diffs = hasBefore ? getDiffs(entry.before, entry.after) : []}
	{#if diffs.length > 0 && !entry.action.endsWith('.created')}
		<div class="flex justify-end">
			<Button
				variant="outline"
				class="h-7 px-2 text-xs"
				onclick={() => { selectedEntry = entry; showDrawer = true }}
			>
				<FileJson class="h-3.5 w-3.5 mr-1" /> Details
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
			{#each ENTITY_TYPES as t}
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

	<DataTable 
		data={entries} 
		{columns}
		{toolbar}
		isLoading={loading}
	/>

	<!-- pagination -->
	{#if totalPages > 1}
		<div class="flex items-center justify-between border-t border-border pt-4">
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
		<div class="flex items-center justify-between border-b border-border px-6 py-4">
			<h2 class="text-lg font-bold text-slate-900 dark:text-white">
				Audit Details
			</h2>
			<Button onclick={() => showDrawer = false} variant="outline" class="h-8 px-3 text-xs">
				Close
			</Button>
		</div>

		{#if selectedEntry}
			{@const diffs = getDiffs(selectedEntry.before, selectedEntry.after)}
			<div class="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 space-y-6">
				<div class="grid grid-cols-2 gap-4 text-sm bg-white dark:bg-slate-900 p-4 rounded-lg border border-border shadow-sm">
					<div>
						<p class="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Time</p>
						<p class="font-medium mt-0.5">{formatDate(selectedEntry.created_at)}</p>
					</div>
					<div>
						<p class="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Action</p>
						<p class="font-mono text-xs mt-1 bg-muted px-1.5 py-0.5 rounded w-fit">{selectedEntry.action}</p>
					</div>
					<div>
						<p class="text-muted-foreground text-xs font-semibold uppercase tracking-wide">User</p>
						<p class="font-medium mt-0.5">{selectedEntry.user_name || selectedEntry.user_id}</p>
					</div>
					<div>
						<p class="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Entity</p>
						<p class="font-medium mt-0.5">
							<span class="text-muted-foreground text-xs mr-1">{selectedEntry.entity_type}</span>
							{selectedEntry.entity_name || selectedEntry.entity_id}
						</p>
					</div>
				</div>

				<div class="flex flex-col gap-4">
					{#if diffs.length === 0}
						<div class="p-6 text-center text-muted-foreground border border-border rounded-lg bg-white dark:bg-slate-900">
							No changes detected
						</div>
					{:else}
						{#each diffs as diff}
							<div class="bg-white dark:bg-slate-900 border border-border rounded-lg shadow-sm overflow-hidden flex flex-col">
								<div class="bg-muted/50 px-3 py-2 border-b border-border">
									<span class="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{diff.key}</span>
								</div>
								<div class="grid grid-cols-1 divide-y divide-border">
									{#if diff.oldVal !== undefined}
										<div class="flex items-start p-3 gap-3 bg-rose-50/50 dark:bg-rose-950/20">
											<span class="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0"></span>
											<pre class="text-xs font-mono text-slate-600 dark:text-slate-400 overflow-x-auto m-0 opacity-80 line-through">{JSON.stringify(diff.oldVal, null, 2)}</pre>
										</div>
									{/if}
									{#if diff.newVal !== undefined}
										<div class="flex items-start p-3 gap-3 bg-emerald-50/50 dark:bg-emerald-950/20">
											<span class="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
											<pre class="text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto m-0">{JSON.stringify(diff.newVal, null, 2)}</pre>
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
