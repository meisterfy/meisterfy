<script lang="ts">
	import type { PageData } from './$types';
	import { FileEdit, CheckCircle, Send, Trash2, Search, Target, DollarSign, Activity, AlertCircle, Plus, Filter, MoreHorizontal, ChevronRight, Play } from 'lucide-svelte';
	import type { GoogleAdCampaignWithMeta } from '$lib/server/db';

	let { data } = $props<{ data: PageData }>();
</script>

<div class="px-4 sm:px-6 lg:px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
	<div class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
		<a href="/{data.tenant}/ads/google" class="hover:text-slate-900 dark:hover:text-white font-medium flex items-center gap-1">
			<Search class="w-4 h-4 text-indigo-500" /> Google Ads
		</a>
		<ChevronRight class="w-4 h-4" />
		<span>Campaigns</span>
	</div>
	
	<button class="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md font-medium text-sm transition-colors shadow-sm">
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
										<button class="p-1.5 text-slate-600 hover:text-indigo-600 bg-white hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-900/30 border border-slate-200 dark:border-slate-700 rounded shadow-sm transition-colors" title="Deploy">
											<Send class="w-4 h-4" />
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