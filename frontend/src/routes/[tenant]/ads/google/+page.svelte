<script lang="ts">
	import type { PageData } from './$types'
	import {
		FileEdit,
		CheckCircle,
		Send,
		Trash2,
		Search,
		Target,
		DollarSign,
		Activity,
		AlertCircle,
		Plus,
		Filter,
		ChevronRight,
		Play,
		FileJson,
		X,
		Loader2
	} from 'lucide-svelte'
	import Skeleton from '$lib/components/ui/skeleton.svelte'
	import { createCampaign, deployCampaign as apiDeployCampaign } from '$lib/api/campaigns'

	let { data } = $props<{ data: PageData }>()

	let isImportModalOpen = $state(false)
	let jsonInput = $state('')
	let importError = $state('')
	let isImporting = $state(false)
	let deployingSlug = $state<string | null>(null)
	let deployResult = $state<{ success: boolean; message: string } | null>(null)

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

	async function deployCampaign(slug: string) {
		deployingSlug = slug
		deployResult = null
		try {
			await apiDeployCampaign(data.tenant, slug)
			deployResult = {
				success: true,
				message: 'Campaign deployed successfully. All assets created as PAUSED in Google Ads.'
			}
			setTimeout(() => window.location.reload(), 2000)
		} catch {
			deployResult = { success: false, message: 'Deploy failed.' }
		} finally {
			deployingSlug = null
		}
	}
</script>

<div
	class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-slate-900"
>
	<div class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
		<a
			href="/{data.tenant}/ads/google"
			class="flex items-center gap-1 font-medium hover:text-slate-900 dark:hover:text-white"
		>
			<Search class="h-4 w-4 text-indigo-500" /> Google Ads
		</a>
		<ChevronRight class="h-4 w-4" />
		<span>Campaigns</span>
	</div>

	<button
		onclick={() => {
			isImportModalOpen = true
		}}
		class="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
	>
		<Plus class="h-4 w-4" /> New Campaign
	</button>
</div>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<div class="mb-6 flex items-center justify-between">
		<h2 class="text-xl font-bold text-slate-900 dark:text-white">Campaign Manager</h2>
		<div class="flex items-center gap-2">
			<div class="relative">
				<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
				<input
					type="text"
					placeholder="Search campaigns..."
					class="w-64 rounded-md border border-slate-300 bg-white py-1.5 pr-4 pl-9 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
				/>
			</div>
			<button
				class="rounded-md border border-slate-300 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
			>
				<Filter class="h-4 w-4" />
			</button>
		</div>
	</div>

	<div
		class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
	>
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead
					class="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
				>
					<tr>
						<th class="px-6 py-3 font-semibold">Campaign Name / Objective</th>
						<th class="px-6 py-3 font-semibold">Status</th>
						<th class="px-6 py-3 font-semibold">Budget/Cost</th>
						<th class="px-6 py-3 font-semibold">Metrics/Ad Groups</th>
						<th class="px-6 py-3 text-right font-semibold">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200 dark:divide-slate-800">
					{#await Promise.all([data.campaigns, data.streamed.liveCampaigns])}
						{#each Array(5) as _}
							<tr class="animate-pulse">
								<td class="px-6 py-4">
									<div class="flex items-center gap-3">
										<Skeleton class="h-8 w-8 rounded-full" />
										<div class="space-y-2">
											<Skeleton class="h-4 w-32" />
											<Skeleton class="h-3 w-20" />
										</div>
									</div>
								</td>
								<td class="px-6 py-4">
									<Skeleton class="h-6 w-20 rounded-full" />
								</td>
								<td class="px-6 py-4">
									<Skeleton class="h-4 w-16" />
								</td>
								<td class="px-6 py-4">
									<Skeleton class="h-4 w-32" />
								</td>
								<td class="px-6 py-4 text-right">
									<Skeleton class="ml-auto h-8 w-8 rounded" />
								</td>
							</tr>
						{/each}
					{:then [localCampaigns, liveCampaigns]}
						{#if localCampaigns.length === 0 && liveCampaigns.length === 0}
							<tr>
								<td colspan="5" class="px-6 py-8 text-center text-slate-500">
									No campaigns found. <button class="font-medium text-indigo-600 hover:underline"
										>Create your first campaign.</button
									>
								</td>
							</tr>
						{/if}

						{#each liveCampaigns as liveCampaign (liveCampaign.id)}
							<tr class="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
								<td class="px-6 py-4">
									<div class="flex items-center gap-3">
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
										>
											<Play class="h-4 w-4" />
										</div>
										<div>
											<a
												href="/{data.tenant}/ads/google/live/{liveCampaign.id}"
												class="block font-bold text-slate-900 transition-colors hover:text-indigo-600 dark:text-white"
											>
												{liveCampaign.name}
											</a>
											<span class="text-xs text-slate-500">Live in Google Ads</span>
										</div>
									</div>
								</td>
								<td class="px-6 py-4">
									{#if liveCampaign.status === 'ENABLED'}
										<span
											class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400"
										>
											<Activity class="h-3.5 w-3.5" /> Active
										</span>
									{:else if liveCampaign.status === 'PAUSED'}
										<span
											class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
										>
											<AlertCircle class="h-3.5 w-3.5" /> Paused
										</span>
									{:else}
										<span
											class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
										>
											{liveCampaign.status}
										</span>
									{/if}
								</td>
								<td class="px-6 py-4 font-medium text-slate-600 dark:text-slate-300">
									<div class="flex items-center gap-1">
										<DollarSign class="h-3.5 w-3.5 text-slate-400" />
										{liveCampaign.cost}
									</div>
								</td>
								<td class="px-6 py-4">
									<div class="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
										<div>
											<span class="font-semibold">{liveCampaign.impressions}</span> imp
										</div>
										<div>
											<span class="font-semibold">{liveCampaign.clicks}</span> clicks
										</div>
									</div>
								</td>
								<td class="px-6 py-4 text-right">
									<div
										class="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100"
									>
										<a
											href="/{data.tenant}/ads/google/live/{liveCampaign.id}"
											class="rounded border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-indigo-900/30"
											title="View Detailed Report"
										>
											<Activity class="h-4 w-4" />
										</a>
									</div>
								</td>
							</tr>
						{/each}

						{#each localCampaigns as campaign (campaign.id)}
							<tr class="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
								<td class="px-6 py-4">
									<div class="flex items-center gap-3">
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30"
										>
											<Search class="h-4 w-4" />
										</div>
										<div>
											<a
												href="/{data.tenant}/ads/google/{campaign.slug}"
												class="block font-bold text-slate-900 transition-colors hover:text-indigo-600 dark:text-white"
											>
												{campaign.id}
											</a>
											<span class="text-xs text-slate-500">{campaign.objective}</span>
										</div>
									</div>
								</td>
								<td class="px-6 py-4">
									{#if campaign.status === 'draft'}
										<span
											class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400"
										>
											<AlertCircle class="h-3.5 w-3.5" /> Draft
										</span>
									{:else if campaign.status === 'approved'}
										<span
											class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400"
										>
											<CheckCircle class="h-3.5 w-3.5" /> Approved
										</span>
									{:else}
										<span
											class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-400"
										>
											<Activity class="h-3.5 w-3.5" /> Local Status: {campaign.status}
										</span>
									{/if}
								</td>
								<td class="px-6 py-4 font-medium text-slate-600 dark:text-slate-300">
									{campaign.budget_suggestion}
								</td>
								<td class="px-6 py-4">
									<div class="flex items-center gap-2">
										<Target class="h-4 w-4 text-slate-400" />
										<span class="font-medium text-slate-700 dark:text-slate-300"
											>{campaign.ad_groups?.length || 0} Ad Groups</span
										>
									</div>
								</td>
								<td class="px-6 py-4 text-right">
									<div
										class="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100"
									>
										{#if campaign.status === 'approved'}
											<button
												onclick={() => deployCampaign(campaign.slug)}
												disabled={deployingSlug === campaign.slug}
												class="rounded border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-emerald-900/30"
												title="Deploy to Google Ads"
											>
												{#if deployingSlug === campaign.slug}
													<Loader2 class="h-4 w-4 animate-spin" />
												{:else}
													<Send class="h-4 w-4" />
												{/if}
											</button>
										{/if}
										<a
											href="/{data.tenant}/ads/google/{campaign.slug}"
											class="rounded border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-indigo-900/30"
											title="Edit"
										>
											<FileEdit class="h-4 w-4" />
										</a>
										<button
											class="rounded border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-red-900/30"
											title="Delete"
										>
											<Trash2 class="h-4 w-4" />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					{:catch apiError}
						<tr>
							<td colspan="5" class="px-6 py-8 text-center">
								{#if apiError?.message === 'invalid_grant'}
									<div class="flex flex-col items-center gap-3 text-amber-700 dark:text-amber-400">
										<AlertCircle class="h-6 w-6 text-amber-500" />
										<p class="text-sm font-medium">
											Google Ads authentication expired (invalid_grant)
										</p>
										<a
											href="/auth/google-ads/start"
											target="_blank"
											rel="noopener"
											class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
										>
											Re-authenticate with Google
										</a>
										<p class="max-w-sm text-xs text-slate-500 dark:text-slate-400">
											After authorizing, the token is stored automatically via the Go API OAuth
											flow.
										</p>
									</div>
								{:else}
									<div class="flex items-center justify-center gap-2 text-red-500">
										<AlertCircle class="h-4 w-4" />
										<span class="text-sm font-medium">Google Ads API error:</span>
										<span class="font-mono text-sm text-red-400"
											>{apiError?.message ?? 'unknown error'}</span
										>
									</div>
								{/if}
							</td>
						</tr>
					{/await}
				</tbody>
			</table>
		</div>
	</div>
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
			<CheckCircle class="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
		{:else}
			<AlertCircle class="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
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
					<FileJson class="h-5 w-5 text-indigo-500" /> Import Google Ads Campaign
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
					Paste the campaign JSON generated by the agent. Must include <code
						class="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800"
						>result.platform = "google_search"</code
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
						<Loader2 class="h-4 w-4 animate-spin" /> Importing...
					{:else}
						<FileJson class="h-4 w-4" /> Import Campaign
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
