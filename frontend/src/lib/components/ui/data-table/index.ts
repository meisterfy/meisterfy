import type { ColumnDef, Table } from "@tanstack/table-core"

export { default as FlexRender } from "./flex-render.svelte"
export * from "./render-helpers.js"
export * from "./data-table.svelte.ts"

export interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
}

export type { ColumnDef, Table }
