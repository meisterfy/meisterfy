<script lang="ts" generics="TData, TValue">
	import {
		getCoreRowModel,
		getPaginationRowModel,
		getSortedRowModel,
		getFilteredRowModel,
		type ColumnDef,
		type PaginationState,
		type SortingState,
		type ColumnFiltersState
	} from '@tanstack/table-core'
	import { createSvelteTable, FlexRender } from './index.js'
	import * as Table from '$lib/components/ui/table/index.js'
	import { Search } from 'lucide-svelte'
	import { type Snippet, untrack } from 'svelte'
	import * as m from '$lib/paraglide/messages.js'

	let {
		data,
		columns,
		pageSize = 50,
		searchPlaceholder = 'Search...',
		searchColumn,
		toolbar,
		isLoading = false,
		meta
	} = $props<{
		data: TData[]
		columns: ColumnDef<TData, TValue>[]
		pageSize?: number
		searchPlaceholder?: string
		searchColumn?: string
		toolbar?: Snippet<[table: any]>
		isLoading?: boolean
		meta?: any
	}>()

	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: untrack(() => pageSize) })
	let sorting = $state<SortingState>([])
	let columnFilters = $state<ColumnFiltersState>([])

	const table = createSvelteTable({
		get data() {
			return data
		},
		get columns() {
			return columns
		},
		state: {
			get pagination() {
				return pagination
			},
			get sorting() {
				return sorting
			},
			get columnFilters() {
				return columnFilters
			}
		},
		get meta() {
			return meta
		},
		onPaginationChange: (updater) => {
			if (typeof updater === 'function') {
				pagination = updater(pagination)
			} else {
				pagination = updater
			}
		},
		onSortingChange: (updater) => {
			if (typeof updater === 'function') {
				sorting = updater(sorting)
			} else {
				sorting = updater
			}
		},
		onColumnFiltersChange: (updater) => {
			if (typeof updater === 'function') {
				columnFilters = updater(columnFilters)
			} else {
				columnFilters = updater
			}
		},
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	})

	// Local search value for better reactivity in the input field
	let searchValue = $state('')
	$effect(() => {
		const value = searchValue
		untrack(() => {
			if (searchColumn) {
				table.getColumn(searchColumn)?.setFilterValue(value)
			}
		})
	})

	// Derived rows to ensure Svelte 5 tracks table updates
	const rows = $derived(table.getRowModel().rows)
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			{#if searchColumn}
				<div class="relative">
					<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						placeholder={searchPlaceholder}
						bind:value={searchValue}
						class="w-64 rounded-md border border-slate-300 bg-white py-1.5 pr-4 pl-9 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
					/>
				</div>
			{/if}
			{@render toolbar?.(table)}
		</div>
	</div>

	<div
		class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
	>
		<div class="overflow-x-auto">
			<Table.Root class="w-full text-left text-sm">
				<Table.Header
					class="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
				>
					{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
						<Table.Row>
							{#each headerGroup.headers as header (header.id)}
								<Table.Head class="px-6 py-3 font-semibold">
									{#if !header.isPlaceholder}
										<button
											type="button"
											class="flex items-center gap-2 {header.column.getCanSort()
												? 'cursor-pointer select-none hover:text-slate-900 dark:hover:text-white'
												: ''}"
											onclick={header.column.getToggleSortingHandler()}
										>
											<FlexRender
												content={header.column.columnDef.header}
												context={header.getContext()}
											/>
											{#if header.column.getIsSorted()}
												<span class="text-indigo-500">
													{header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
												</span>
											{/if}
										</button>
									{/if}
								</Table.Head>
							{/each}
						</Table.Row>
					{/each}
				</Table.Header>
				<Table.Body class="divide-y divide-slate-200 dark:divide-slate-800">
					{#if isLoading}
						{#each Array(5) as _}
							<Table.Row class="animate-pulse">
								{#each columns as _}
									<Table.Cell class="px-6 py-4">
										<div class="h-4 w-full rounded bg-slate-100 dark:bg-slate-800"></div>
									</Table.Cell>
								{/each}
							</Table.Row>
						{/each}
					{:else}
						{#each rows as row (row.id)}
							<Table.Row
								class="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
								data-state={row.getIsSelected() && 'selected'}
							>
								{#each row.getVisibleCells() as cell (cell.id)}
									<Table.Cell class="px-6 py-4">
										<FlexRender
											content={cell.column.columnDef.cell}
											context={cell.getContext()}
										/>
									</Table.Cell>
								{/each}
							</Table.Row>
						{:else}
							<Table.Row>
								<Table.Cell colspan={columns.length} class="px-6 py-8 text-center text-slate-500">
									{m['globals:no_options']()}
								</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</div>
	</div>

	{#if table.getPageCount() > 1}
		<div class="flex items-center justify-between px-2 py-4">
			<div class="text-sm text-slate-500 dark:text-slate-400">
				Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
			</div>
			<div class="flex items-center gap-2">
				<button
					class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
					onclick={() => table.previousPage()}
					disabled={!table.getCanPreviousPage()}
				>
					{m['globals:previous']()}
				</button>
				<button
					class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
					onclick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}
				>
					{m['globals:next']()}
				</button>
			</div>
		</div>
	{/if}
</div>
