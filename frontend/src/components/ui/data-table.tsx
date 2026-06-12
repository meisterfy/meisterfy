import { useState, type ReactNode } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { Search } from 'lucide-react'

import { cn } from '@/lib/utils'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  className?: string
  // Optional features — all off unless the relevant prop is passed, so the
  // bare `data + columns` usages (audit, users) keep their exact behaviour.
  // i18n-decoupled: pagination labels come in as strings (like multi-select).
  isLoading?: boolean
  searchColumn?: string
  searchPlaceholder?: string
  pageSize?: number
  toolbar?: ReactNode
  previousLabel?: string
  nextLabel?: string
}

function DataTable<TData, TValue>({
  columns,
  data,
  className,
  isLoading = false,
  searchColumn,
  searchPlaceholder = 'Search...',
  pageSize,
  toolbar,
  previousLabel = 'Previous',
  nextLabel = 'Next',
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const paginated = pageSize !== undefined
  // TanStack Table's useReactTable returns functions that can't be memoized,
  // so React Compiler intentionally skips this component. Accepted + safe here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginated ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    ...(paginated ? { initialState: { pagination: { pageSize } } } : {}),
  })

  const searchValue = searchColumn
    ? ((table.getColumn(searchColumn)?.getFilterValue() as string) ?? '')
    : ''

  const showHeader = Boolean(searchColumn) || Boolean(toolbar)

  const table_ = (
    <div
      data-slot="data-table"
      className={cn(
        'overflow-hidden rounded-xl border bg-card ring-1 ring-foreground/10 shadow-sm',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"
              >
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-6 py-3 font-semibold">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map((_, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  No results
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  // No optional features → preserve the original single-element output exactly.
  if (!showHeader && !paginated) return table_

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center gap-2">
          {searchColumn && (
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) =>
                  table.getColumn(searchColumn)?.setFilterValue(e.target.value)
                }
                className="w-64 rounded-md border border-slate-300 bg-white py-1.5 pr-4 pl-9 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          )}
          {toolbar}
        </div>
      )}

      {table_}

      {paginated && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              {previousLabel}
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              {nextLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export { DataTable }
