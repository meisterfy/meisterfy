<script lang="ts">
	import { untrack } from 'svelte'
	import type { PageData } from './$types'
	import { resolve } from '$app/paths'
	import { ArrowLeft, Save, Search, LayoutList } from 'lucide-svelte'
	import { updateCampaign } from '$lib/api/campaigns'
	import { m } from '$lib/paraglide/messages'

	let { data } = $props<{ data: PageData }>()

	let campaign = $state(untrack(() => data.campaign))
	$effect(() => {
		campaign = data.campaign
	})
	let saving = $state(false)
	let saveError = $state('')

	async function saveCampaign() {
		saving = true
		saveError = ''
		try {
			await updateCampaign(data.tenant, data.campaign.slug as string, { ...campaign })
			window.location.href = `/${data.tenant}/ads/google`
		} catch {
			saveError = 'Failed to save'
		} finally {
			saving = false
		}
	}
</script>

<div
	class="sticky top-0 z-10 flex h-14 items-center border-b border-slate-200 bg-white px-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
>
	<div class="flex items-center gap-4">
		<a
			href={resolve(`/${data.tenant}/ads/google`)}
			class="text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<h2 class="flex items-center gap-2 text-lg font-semibold">
			<Search class="h-4 w-4 text-slate-400" />
			{m['ads:edit_campaign']()}
		</h2>
	</div>
	<div class="ml-auto flex items-center gap-3">
		{#if saveError}
			<span class="text-sm text-red-600 dark:text-red-400">{saveError}</span>
		{/if}
		<button
			onclick={saveCampaign}
			disabled={saving}
			class="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
		>
			<Save class="h-4 w-4" />
			{saving ? 'Saving...' : 'Save Status'}
		</button>
	</div>
</div>

<div class="mx-auto grid max-w-5xl grid-cols-1 gap-8 p-6 lg:grid-cols-3">
	<!-- Editor -->
	<div class="space-y-6 lg:col-span-2">
		<div
			class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
		>
			<h3
				class="mb-4 border-b border-slate-100 pb-2 text-lg font-bold text-slate-900 dark:border-slate-800 dark:text-white"
			>
				{m['ads:campaign_details']()}
			</h3>

			<div class="space-y-4">
				<div>
					<label
						for="campaign-objective"
						class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
						>Objective</label
					>
					<input
						id="campaign-objective"
						type="text"
						bind:value={campaign.objective}
						class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
					/>
				</div>

				<div>
					<label
						for="campaign-budget"
						class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
						>{m['ads:budget_suggestion']()}</label
					>
					<input
						id="campaign-budget"
						type="text"
						bind:value={campaign.budget_suggestion}
						class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
					/>
				</div>
			</div>
		</div>

		<div class="space-y-4">
			<h3 class="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
				<LayoutList class="h-5 w-5 text-indigo-500" />
				{m['ads:ad_groups_section']()}
			</h3>

			{#each campaign.ad_groups as group, i (i)}
				<div
					class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
				>
					<div class="mb-4">
						<label
							for="ad-group-name-{i}"
							class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
							>{m['ads:ad_group_name']()}</label
						>
						<input
							id="ad-group-name-{i}"
							type="text"
							bind:value={campaign.ad_groups[i].name}
							class="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/50"
						/>
					</div>

					<div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label
								for="ad-group-keywords-{i}"
								class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
								>Keywords</label
							>
							<textarea
								id="ad-group-keywords-{i}"
								value={group.keywords.join('\n')}
								rows="4"
								class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
							></textarea>
						</div>
						<div>
							<label
								for="ad-group-neg-{i}"
								class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
								>{m['ads:negative_keywords']()}</label
							>
							<textarea
								id="ad-group-neg-{i}"
								value={group.negative_keywords.join('\n')}
								rows="4"
								class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
							></textarea>
						</div>
					</div>

					<div class="border-t border-slate-100 pt-4 dark:border-slate-800">
						<h4 class="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">
							{m['ads:responsive_search_ad']()}
						</h4>

						<div class="mb-4 space-y-3">
							<span class="text-xs font-semibold tracking-wider text-slate-500 uppercase"
								>{m['ads:headlines_label']()}</span
							>
							{#each group.responsive_search_ad.headlines as headline (headline)}
								<div class="flex items-center gap-2">
									<input
										type="text"
										value={headline}
										class="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 {headline.length >
										30
											? 'border-red-500 focus:ring-red-500'
											: ''}"
									/>
									<span
										class="font-mono text-xs {headline.length > 30
											? 'font-bold text-red-500'
											: 'text-slate-400'}">{headline.length}/30</span
									>
								</div>
							{/each}
						</div>

						<div class="space-y-3">
							<span class="text-xs font-semibold tracking-wider text-slate-500 uppercase"
								>{m['ads:descriptions_label']()}</span
							>
							{#each group.responsive_search_ad.descriptions as description (description)}
								<div class="flex items-center gap-2">
									<input
										type="text"
										value={description}
										class="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 {description.length >
										90
											? 'border-red-500 focus:ring-red-500'
											: ''}"
									/>
									<span
										class="font-mono text-xs {description.length > 90
											? 'font-bold text-red-500'
											: 'text-slate-400'}">{description.length}/90</span
									>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Sidebar Meta -->
	<div class="space-y-6">
		<div
			class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
		>
			<h3 class="mb-3 text-sm font-bold text-slate-900 dark:text-white">
				{m['ads:campaign_info']()}
			</h3>
			<div class="space-y-3 text-sm text-slate-600 dark:text-slate-400">
				<div class="flex items-center justify-between">
					<span>ID</span>
					<span class="font-mono text-xs">{campaign.id}</span>
				</div>
				<div class="flex items-center justify-between">
					<span>Status</span>
					<select
						bind:value={campaign.status}
						class="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 {campaign.status ===
						'approved'
							? 'text-emerald-600'
							: 'text-amber-600'}"
					>
						<option value="draft" class="font-medium text-amber-600">draft</option>
						<option value="approved" class="font-medium text-emerald-600">approved</option>
					</select>
				</div>
				<div class="flex items-center justify-between">
					<span>Platform</span>
					<span class="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600 uppercase"
						>{campaign.platform}</span
					>
				</div>
			</div>
		</div>

		{#if campaign.workflow}
			<div
				class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
			>
				<h3 class="mb-3 text-sm font-bold text-slate-900 dark:text-white">
					{m['ads:ai_reasoning']()}
				</h3>
				<p class="text-sm text-slate-700 dark:text-slate-300">
					{campaign.workflow.reasoning}
				</p>
			</div>
		{/if}
	</div>
</div>
