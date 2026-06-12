import type { ColumnDef } from '@tanstack/table-core'
import { renderComponent } from '$lib/components/ui/data-table/index.js'
import CampaignStatusBadge from './components/campaign-status-badge.svelte'
import CampaignNameCell from './components/campaign-name-cell.svelte'
import CampaignActions from './components/campaign-actions.svelte'
import * as m from '$lib/paraglide/messages.js'

export interface UnifiedCampaign {
	id: string
	name: string
	slug?: string
	status: string
	cost?: string
	impressions?: number
	clicks?: number
	objective?: string
	type: 'live' | 'local'
	tenant: string
}

export const columns: ColumnDef<UnifiedCampaign>[] = [
	{
		id: 'name',
		accessorKey: 'name',
		header: m['ads:campaign_name'](),
		cell: ({ row }) =>
			renderComponent(CampaignNameCell, {
				name: row.original.name,
				id: row.original.id,
				slug: row.original.slug,
				type: row.original.type,
				objective: row.original.objective,
				tenant: row.original.tenant
			})
	},
	{
		accessorKey: 'status',
		header: m['ads:status'](),
		cell: ({ row }) =>
			renderComponent(CampaignStatusBadge, {
				status: row.original.status,
				type: row.original.type
			})
	},
	{
		accessorKey: 'cost',
		header: 'Budget',
		cell: ({ row }) => row.original.cost ?? '-'
	},
	{
		accessorKey: 'impressions',
		header: m['ads:labels.impressions'](),
		cell: ({ row }) =>
			row.original.impressions !== undefined ? `${row.original.impressions} imp` : '-'
	},
	{
		accessorKey: 'clicks',
		header: m['ads:labels.clicks'](),
		cell: ({ row }) => (row.original.clicks !== undefined ? `${row.original.clicks} clicks` : '-')
	},
	{
		id: 'actions',
		header: '',
		cell: ({ row, table }) =>
			renderComponent(CampaignActions, {
				campaign: row.original,
				onDeploy: (table.options.meta as Record<string, unknown>)?.onDeploy as
					| ((slug: string) => void)
					| undefined
			})
	}
]
