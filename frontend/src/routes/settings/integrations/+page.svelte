<script lang="ts">
	import { CircleCheck } from 'lucide-svelte'
	import Skeleton from '$lib/components/ui/skeleton.svelte'
	import ConfirmDialog from '$lib/components/ui/dialog/confirm-dialog.svelte'
	import type { PageData } from './$types'
	import CardAdd from '@/lib/components/ui/card/connection/card-add.svelte'
	import CardConnected from '@/lib/components/ui/card/connection/card-connected.svelte'
	import { IntegrationManager } from './integrations.svelte'
	import IntegrationFilters from './components/integration-filters.svelte'
	import IntegrationSection from './components/integration-section.svelte'
	import IntegrationModal from './components/integration-modal.svelte'

	let { data } = $props<{ data: PageData }>()

	const manager = new IntegrationManager()

	$effect(() => {
		manager.init(data)
	})
</script>

<div class="w-full px-4 py-8 sm:px-6 lg:px-8">
	{#if manager.justConnected}
		<div
			class="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
		>
			<CircleCheck class="h-4 w-4 shrink-0" />
			{manager.connectedMessage}
		</div>
	{/if}

	{#if manager.isLoading}
		<div class="space-y-8">
			{#each Array(2) as _}
				<section>
					<Skeleton class="mb-3 h-4 w-24" />
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
						{#each Array(8) as _}
							<div
								class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
							>
								<div class="flex items-center gap-2.5">
									<Skeleton class="h-8 w-8 rounded-lg" />
									<div class="flex-1 space-y-2">
										<Skeleton class="h-4 w-24" />
										<Skeleton class="h-3 w-16" />
									</div>
								</div>
								<Skeleton class="mt-2 h-4 w-full" />
							</div>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{:else}
		{#if manager.integrations.length > 0}
			<IntegrationSection 
				title="Connected" 
				description="Your active service integrations."
			>
				{#each manager.integrations as integration (integration.id)}
					{@const provider = manager.providerForIntegration(integration)}
					{#if provider}
						<CardConnected
							{integration}
							{provider}
							tenantOptions={manager.tenantOptions}
							onEdit={() => manager.openEdit(integration, provider)}
							onDelete={() => manager.confirmDelete(integration.id)}
						/>
					{/if}
				{/each}
			</IntegrationSection>
		{/if}

		<section class="mb-8">
			<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h2 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
						Connections
					</h2>
					<p class="text-sm text-slate-500">
						Browse and add new integrations to your workspace.
					</p>
				</div>

				<IntegrationFilters 
					bind:searchQuery={manager.searchQuery}
					bind:selectedCategory={manager.selectedCategory}
					categories={manager.GROUP_ORDER}
					categoryLabels={manager.GROUP_LABELS}
					onClear={() => manager.clearFilters()}
				/>
			</div>

			{#if manager.filteredProviders.length > 0}
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
					{#each manager.filteredProviders as provider (provider.provider)}
						<CardAdd {provider} onclick={() => manager.openCreate(provider)} />
					{/each}
				</div>
			{:else}
				<div
					class="rounded-xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
				>
					<p class="text-sm text-slate-400">
						No connections match your filters.
					</p>
					<button
						onclick={() => manager.clearFilters()}
						class="mt-2 text-sm font-medium text-indigo-600 hover:underline"
					>
						Clear all filters
					</button>
				</div>
			{/if}
		</section>

		{#if manager.providers.length === 0}
			<div
				class="rounded-xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
			>
				<p class="text-sm text-slate-400">
					No providers available.
				</p>
			</div>
		{/if}
	{/if}
</div>

<IntegrationModal
	{manager}
	onSave={() => manager.handleSave()}
	onTest={() => manager.handleTest()}
/>

<ConfirmDialog
	bind:open={manager.showDelete}
	title="Delete integration?"
	description="This will permanently remove the integration and disconnect all associated clients. This cannot be undone."
	confirmLabel="Delete"
	isLoading={manager.isDeleting}
	onconfirm={() => manager.handleDelete()}
/>
