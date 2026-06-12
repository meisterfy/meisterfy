<script lang="ts">
	import type { PageData } from './$types'
	import {
		Plus,
		Funnel,
		CircleAlert,
		CircleCheck,
		FileBraces,
		X,
		LoaderCircle
	} from 'lucide-svelte'
	import { createCampaign } from '$lib/api/campaigns'
	import { columns, type UnifiedCampaign } from './columns'
	import DataTable from '$lib/components/ui/data-table/data-table.svelte'
	import { m } from '$lib/paraglide/messages'

	let { data } = $props<{ data: PageData }>()

	let isImportModalOpen = $state(false)
	let jsonInput = $state('')
	let importError = $state('')
	let isImporting = $state(false)
	let deployResult = $state<{ success: boolean; message: string } | null>(null)

	// Combine local and live campaigns for the table
	let combinedCampaigns = $state<UnifiedCampaign[]>([])
	let isLoading = $state(true)

	$effect(() => {
		Promise.all([data.campaigns, data.streamed.liveCampaigns])
			.then(([local, live]) => {
				const unifiedLocal: UnifiedCampaign[] = (local as UnifiedCampaign[]).map((c) => ({
					id: c.id,
					name: c.id,
					slug: c.slug,
					status: c.status,
					objective: c.objective,
					type: 'local',
					tenant: data.tenant
				}))

				const unifiedLive: UnifiedCampaign[] = (live as UnifiedCampaign[]).map((c) => ({
					id: c.id,
					name: c.name,
					status: c.status,
					cost: c.cost,
					impressions: c.impressions,
					clicks: c.clicks,
					type: 'live',
					tenant: data.tenant
				}))

				combinedCampaigns = [...unifiedLive, ...unifiedLocal]
			})
			.catch((err) => {
				console.error('Failed to load campaigns:', err)
			})
			.finally(() => {
				isLoading = false
			})
	})

	async function importCampaign() {
		importError = ''
		if (!jsonInput.trim()) {
			importError = 'JSON cannot be empty'
			return
		}

		let parsed: { result?: { id?: string; platform?: string } }
		try {
			parsed = JSON.parse(jsonInput)
		} catch {
			importError = 'Invalid JSON format'
			return
		}

		if (!parsed.result?.id || parsed.result?.platform !== 'google_search') {
			importError = 'Missing result.id or result.platform must be "google_search"'
			return
		}

		isImporting = true
		try {
			const slug = parsed.result.id
			await createCampaign(data.tenant, { slug, data: parsed })
			isImportModalOpen = false
			jsonInput = ''
			window.location.reload()
		} catch {
			importError = 'Failed to import campaign'
		} finally {
			isImporting = false
		}
	}
</script>

<div class="mx-auto w-full max-w-full px-4 py-8 sm:px-6 lg:w-[1200px] lg:px-8 xl:w-[1600px]">
	<div class="mb-6 flex items-center justify-between">
		<h2 class="text-xl font-bold text-slate-900 lg:text-3xl dark:text-white">
			{m['ads:campaign_manager']()}
		</h2>
		<div class="flex items-center gap-2">
			<button
				onclick={() => {
					isImportModalOpen = true
				}}
				class="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
			>
				<Plus class="h-4 w-4" />
				{m['ads:new_campaign']()}
			</button>
		</div>
	</div>

	<DataTable
		data={combinedCampaigns}
		{columns}
		{isLoading}
		searchColumn="name"
		searchPlaceholder={m['ads:search_campaigns_placeholder']()}
		pageSize={50}
	>
		{#snippet toolbar(_)}
			<button
				class="rounded-md border border-slate-300 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
			>
				<Funnel class="h-4 w-4" />
			</button>
		{/snippet}
	</DataTable>
</div>

{#if deployResult}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed right-6 bottom-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-5 py-4 text-sm font-medium shadow-xl
			{deployResult.success
			? 'border-emerald-200 bg-emerald-50 text-emerald-800'
			: 'border-red-200 bg-red-50 text-red-800'}"
		onclick={() => (deployResult = null)}
	>
		{#if deployResult.success}
			<CircleCheck class="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
		{:else}
			<CircleAlert class="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
		{/if}
		<span>{deployResult.message}</span>
	</div>
{/if}

{#if isImportModalOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
	>
		<div class="absolute inset-0" onclick={() => (isImportModalOpen = false)}></div>
		<div
			class="relative z-100 flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
		>
			<div
				class="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800"
			>
				<h3 class="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
					<FileBraces class="h-5 w-5 text-indigo-500" />
					{m['ads:import_title']()}
				</h3>
				<button
					onclick={() => (isImportModalOpen = false)}
					class="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="flex-1 overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950/50">
				{#if importError}
					<div
						class="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400"
					>
						{importError}
					</div>
				{/if}
				<p class="mb-3 text-sm text-slate-500 dark:text-slate-400">
					{m['ads:import_instructions']()}
					<code class="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800"
						>{m['ads:import_platform_hint']()}</code
					>.
				</p>
				<textarea
					bind:value={jsonInput}
					class="h-72 w-full rounded-md border border-slate-300 bg-white p-4 font-mono text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
					placeholder={`{\n  "workflow": { "reasoning": "..." },\n  "result": {\n    "id": "YYYY-MM-DD_slug",\n    "platform": "google_search",\n    "status": "draft",\n    ...\n  }\n}`}
				></textarea>
			</div>

			<div
				class="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900"
			>
				<button
					onclick={() => (isImportModalOpen = false)}
					class="px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
					>Cancel</button
				>
				<button
					onclick={importCampaign}
					disabled={isImporting}
					class="flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
				>
					{#if isImporting}
						<LoaderCircle class="h-4 w-4 animate-spin" /> {m['ads:importing']()}
					{:else}
						<FileBraces class="h-4 w-4" /> {m['ads:import_submit']()}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
