<script lang="ts">
	import ProviderIcon from '$lib/components/ui/provider-icon.svelte'
	import Card from '$lib/components/ui/card/connection/card.svelte'
	import FooterBtn from '$lib/components/ui/card/connection/card-footer-btn.svelte'
	import CardBadge from '$lib/components/ui/card/connection/card-badge.svelte'
	import { Pencil, Trash2, Link2, CircleCheck, CircleX, CircleAlert, UsersRound } from 'lucide-svelte'
	import type { Integration, ProviderSchema } from '$lib/api/integrations'

	let { 
		integration, 
		provider, 
		tenantOptions = [],
		onEdit, 
		onDelete
	} = $props<{
		integration: Integration
		provider: ProviderSchema
		tenantOptions?: { value: string; label: string }[]
		onEdit: () => void
		onDelete: () => void
	}>()

	const STATUS_MAP = {
		connected: {
			label: 'Connected',
			variant: 'success' as const,
			Icon: CircleCheck
		},
		pending: {
			label: 'Not connected',
			variant: 'warning' as const,
			Icon: CircleX
		},
		error: {
			label: 'Error',
			variant: 'error' as const,
			Icon: CircleAlert
		}
	} as const

	const status = $derived(STATUS_MAP[integration.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.pending)

	const connectHref = $derived(provider.oauth_flow && provider.oauth_start_path 
		? `${provider.oauth_start_path}?integration_id=${integration.id}` 
		: null
	)
</script>

<Card>
	<div class="flex flex-row gap-2 items-start justify-start p-4">
		<div class="w-16 h-16 shrink-0 bg-slate-500/10 border border-slate-500/15 rounded-lg flex items-center justify-center">
			<div class="h-8 w-8 text-white">
				<ProviderIcon 
					provider={provider.provider} 
					logoSvg={provider.logo_svg}
					logoPng={provider.logo_png}
				/>
			</div>
		</div>
		<div class="flex flex-col min-w-0 flex-1 gap-2">
			<div class="flex items-start justify-between gap-2">
				<div class="min-w-0">
					<h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
						{provider.display_name}
					</h3>
					<p class="text-xs text-slate-400">
						{integration.name}
					</p>
				</div>
				<CardBadge 
					variant={status.variant}
					icon={status.Icon} 
				/>
			</div>

			{#if integration.status === 'error' && integration.error_message}
				<p class="truncate text-[10px] text-red-500 font-medium">
					{integration.error_message}
				</p>
			{/if}
		</div>
	</div>
	{#if integration.tenant_ids.length > 0}
		<div class="flex items-center flex-wrap gap-2 px-4 pt-3 pb-1 border-t border-t-slate-500/20">
			<UsersRound class="text-slate-400 w-4 h-4" />
			{#each integration.tenant_ids as tid (tid)}
				{@const opt = tenantOptions.find((o: { value: string; label: string }) => o.value === tid)}
				<CardBadge label={opt?.label ?? tid} />
			{/each}
		</div>
	{/if}
	{#snippet footer()}
		<div class="flex w-full items-center gap-2">
			{#if connectHref}
				<FooterBtn
					href={connectHref}
					variant="primary"
					label={integration.status === 'connected' ? 'Re-auth' : 'Connect'}
					icon={Link2}
				/>
			{/if}

			<div class="ml-auto flex items-center gap-2">
				<FooterBtn
					onclick={onEdit}
					variant="default"
					title="Edit"
					icon={Pencil}
				/>
				<FooterBtn
					onclick={onDelete}
					variant="danger"
					title="Delete"
					icon={Trash2}
				/>
			</div>
		</div>
	{/snippet}
</Card>


