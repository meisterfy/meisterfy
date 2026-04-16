<script lang="ts">
	import type { PageData } from './$types';
	import { FileEdit, CheckCircle, Send, Trash2, Search, Target, DollarSign, Activity, AlertCircle, Plus, Filter, ChevronRight, Play, FileJson, X, Loader2 } from 'lucide-svelte';
	import type { GoogleAdCampaignWithMeta } from '$lib/server/db';

	let { data } = $props<{ data: PageData }>();

	let isImportModalOpen = $state(false);
	let jsonInput = $state('');
	let importError = $state('');
	let isImporting = $state(false);
	let deployingFilename = $state<string | null>(null);
	let deployResult = $state<{ success: boolean; message: string } | null>(null);

	async function importCampaign() {
		importError = '';
		if (!jsonInput.trim()) { importError = 'JSON cannot be empty'; return; }

		let parsed: { result?: { id?: string; platform?: string } };
		try { parsed = JSON.parse(jsonInput); }
		catch { importError = 'Invalid JSON format'; return; }

		if (!parsed.result?.id || parsed.result?.platform !== 'google_search') {
			importError = 'Missing result.id or result.platform must be "google_search"';
			return;
		}

		isImporting = true;
		const res = await fetch(`/api/ads/google/${data.tenant}/import`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(parsed)
		});
		isImporting = false;

		if (res.ok) {
			isImportModalOpen = false;
			jsonInput = '';
			window.location.reload();
		} else {
			const err = await res.json();
			importError = err.error || 'Failed to import campaign';
		}
	}

	async function deployCampaign(filename: string) {
		deployingFilename = filename;
		deployResult = null;
		const res = await fetch(`/api/ads/google/${data.tenant}/${filename}/deploy`, { method: 'POST' });
		const body = await res.json();
		deployingFilename = null;
		if (res.ok) {
			deployResult = { success: true, message: 'Campaign deployed successfully. All assets created as PAUSED in Google Ads.' };
			setTimeout(() => window.location.reload(), 2000);
		} else {
			deployResult = { success: false, message: body.error || 'Deploy failed.' };
		}
	}
</script>

<div class="px-4 sm:px-6 lg:px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
	<div class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
		<a href="/{data.tenant}/ads/google" class="hover:text-slate-900 dark:hover:text-white font-medium flex items-center gap-1">
			<Search class="w-4 h-4 text-indigo-500" /> Google Ads
		</a>
		<ChevronRight class="w-4 h-4" />
		<span>Campaigns</span>
	</div>
	
	<button
		onclick={() => { isImportModalOpen = true; }}
		class="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md font-medium text-sm transition-colors shadow-sm"
	>
		<Plus class="w-4 h-4" /> New Campaign
	</button>
</div>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<div class="flex items-center justify-between mb-6">
		<h2 class="text-xl font-bold text-slate-900 dark:text-white">Campaign Manager</h2>
		<div class="flex items-center gap-2">
			<div class="relative">
				<Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
				<input type="text" placeholder="Search campaigns..." class="pl-9 pr-4 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none w-64" />
			</div>
			<button class="p-1.5 border border-slate-300 dark:border-slate-700 rounded-md text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
				<Filter class="w-4 h-4" />
			</button>
		</div>
	</div>

	<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead class="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
					<tr>
						<th class="px-6 py-3 font-semibold">Campaign Name / Objective</th>
						<th class="px-6 py-3 font-semibold">Status</th>
						<th class="px-6 py-3 font-semibold">Budget/Cost</th>
						<th class="px-6 py-3 font-semibold">Metrics/Ad Groups</th>
						<th class="px-6 py-3 font-semibold text-right">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200 dark:divide-slate-800">
					{#await data.streamed.liveCampaigns}
						<tr>
							<td colspan="5" class="px-6 py-8 text-center text-slate-500">
								<div class="flex items-center justify-center gap-2">
									<Activity class="w-4 h-4 animate-spin text-indigo-500" />
									Loading live campaigns from Google Ads...
								</div>
							</td>
						</tr>
					{:then liveCampaigns}
						{#if data.campaigns.length === 0 && liveCampaigns.length === 0}
							<tr>
								<td colspan="5" class="px-6 py-8 text-center text-slate-500">
									No campaigns found. <button class="text-indigo-600 hover:underline font-medium">Create your first campaign.</button>
								</td>
							</tr>
						{/if}
						
						{#each liveCampaigns as liveCampaign (liveCampaign.id)}
							<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
								<td class="px-6 py-4">
									<div class="flex items-center gap-3">
										<div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shrink-0">
											<Play class="w-4 h-4" />
										</div>
										<div>
											<a href="/{data.tenant}/ads/google/live/{liveCampaign.id}" class="font-bold text-slate-900 dark:text-white hover:text-indigo-600 transition-colors block">
												{liveCampaign.name}
											</a>
											<span class="text-xs text-slate-500">Live in Google Ads</span>
										</div>
									</div>
								</td>
								<td class="px-6 py-4">
									{#if liveCampaign.status === 'ENABLED'}
										<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
											<Activity class="w-3.5 h-3.5" /> Active
										</span>
									{:else if liveCampaign.status === 'PAUSED'}
										<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
											<AlertCircle class="w-3.5 h-3.5" /> Paused
										</span>
									{:else}
										<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
											{liveCampaign.status}
										</span>
									{/if}
								</td>
								<td class="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">
									<div class="flex items-center gap-1">
										<DollarSign class="w-3.5 h-3.5 text-slate-400" />
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
									<div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
										<a href="/{data.tenant}/ads/google/live/{liveCampaign.id}" class="p-1.5 text-slate-600 hover:text-indigo-600 bg-white hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-900/30 border border-slate-200 dark:border-slate-700 rounded shadow-sm transition-colors" title="View Detailed Report">
											<Activity class="w-4 h-4" />
										</a>
									</div>
								</td>
							</tr>
						{/each}
					{/await}

					{#each data.campaigns as campaign (campaign.id)}
						<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
							<td class="px-6 py-4">
								<div class="flex items-center gap-3">
									<div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shrink-0">
										<Search class="w-4 h-4" />
									</div>
									<div>
										<a href="/{data.tenant}/ads/google/{campaign.filename}" class="font-bold text-slate-900 dark:text-white hover:text-indigo-600 transition-colors block">
											{campaign.id}
										</a>
										<span class="text-xs text-slate-500">{campaign.objective}</span>
									</div>
								</div>
							</td>
							<td class="px-6 py-4">
								{#if campaign.status === 'draft'}
									<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
										<AlertCircle class="w-3.5 h-3.5" /> Draft
									</span>
								{:else if campaign.status === 'approved'}
									<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
										<CheckCircle class="w-3.5 h-3.5" /> Approved
									</span>
								{:else}
									<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
										<Activity class="w-3.5 h-3.5" /> Local Status: {campaign.status}
									</span>
								{/if}
							</td>
							<td class="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">
								{campaign.budget_suggestion}
							</td>
							<td class="px-6 py-4">
								<div class="flex items-center gap-2">
									<Target class="w-4 h-4 text-slate-400" />
									<span class="font-medium text-slate-700 dark:text-slate-300">{campaign.ad_groups?.length || 0} Ad Groups</span>
								</div>
							</td>
							<td class="px-6 py-4 text-right">
								<div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
									{#if campaign.status === 'approved'}
										<button
											onclick={() => deployCampaign(campaign.filename)}
											disabled={deployingFilename === campaign.filename}
											class="p-1.5 text-slate-600 hover:text-emerald-600 bg-white hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-900/30 border border-slate-200 dark:border-slate-700 rounded shadow-sm transition-colors disabled:opacity-50"
											title="Deploy to Google Ads"
										>
											{#if deployingFilename === campaign.filename}
												<Loader2 class="w-4 h-4 animate-spin" />
											{:else}
												<Send class="w-4 h-4" />
											{/if}
										</button>
									{/if}
									<a href="/{data.tenant}/ads/google/{campaign.filename}" class="p-1.5 text-slate-600 hover:text-indigo-600 bg-white hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-900/30 border border-slate-200 dark:border-slate-700 rounded shadow-sm transition-colors" title="Edit">
										<FileEdit class="w-4 h-4" />
									</a>
									<button class="p-1.5 text-slate-600 hover:text-red-600 bg-white hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-900/30 border border-slate-200 dark:border-slate-700 rounded shadow-sm transition-colors" title="Delete">
										<Trash2 class="w-4 h-4" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

{#if deployResult}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed bottom-6 right-6 z-50 max-w-sm px-5 py-4 rounded-xl shadow-xl border text-sm font-medium flex items-start gap-3
			{deployResult.success
				? 'bg-emerald-50 border-emerald-200 text-emerald-800'
				: 'bg-red-50 border-red-200 text-red-800'}"
		onclick={() => deployResult = null}
	>
		{#if deployResult.success}
			<CheckCircle class="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
		{:else}
			<AlertCircle class="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
		{/if}
		<span>{deployResult.message}</span>
	</div>
{/if}

{#if isImportModalOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
		<div class="absolute inset-0" onclick={() => isImportModalOpen = false}></div>
		<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden relative z-10">
			<div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
				<h3 class="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
					<FileJson class="w-5 h-5 text-indigo-500" /> Import Google Ads Campaign
				</h3>
				<button onclick={() => isImportModalOpen = false} class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
					<X class="w-5 h-5" />
				</button>
			</div>

			<div class="p-6 flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950/50">
				{#if importError}
					<div class="mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm font-medium border border-red-200 dark:border-red-900/50">
						{importError}
					</div>
				{/if}
				<p class="text-sm text-slate-500 dark:text-slate-400 mb-3">Paste the campaign JSON generated by the agent. Must include <code class="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">result.platform = "google_search"</code>.</p>
				<textarea
					bind:value={jsonInput}
					class="w-full h-72 font-mono text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
					placeholder={`{\n  "workflow": { "reasoning": "..." },\n  "result": {\n    "id": "YYYY-MM-DD_slug",\n    "platform": "google_search",\n    "status": "draft",\n    ...\n  }\n}`}
				></textarea>
			</div>

			<div class="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-end gap-3">
				<button onclick={() => isImportModalOpen = false} class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
				<button onclick={importCampaign} disabled={isImporting} class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
					{#if isImporting}
						<Loader2 class="w-4 h-4 animate-spin" /> Importing...
					{:else}
						<FileJson class="w-4 h-4" /> Import Campaign
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}