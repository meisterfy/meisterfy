<script lang="ts">
	import { untrack } from 'svelte'
	import { CircleQuestionMark } from 'lucide-svelte'
	import { Switch, Dialog } from 'bits-ui'
	import { updateTenant } from '$lib/api/tenants'
	import type { AdsMonitoringConfig, ReportPrompts } from '$lib/api/tenants'
	import { DEFAULT_PROMPTS, PROMPT_PARAMS } from '$lib/ai/prompts'
	import { m } from '$lib/paraglide/messages'
	import type { PageData } from './$types'
	import CardAside from '$lib/components/ui/card/card-aside.svelte'
	import Container from '$lib/components/ui/container/container.svelte'
	import CardHeader from '$lib/components/ui/card/card-header.svelte'
	import CardContent from '$lib/components/ui/card/card-content.svelte'
	import { SaveButton } from '$lib/components/ui/button'
	import { CheckboxCard } from '$lib/components/ui/checkbox'
	import { NumberField } from '$lib/components/ui/input'

	let { data } = $props<{ data: PageData }>()

	let gadsConnected = $state(false)
	let llmConnected = $state(false)
	let statusLoading = $state(true)
	$effect(() => {
		statusLoading = true
		Promise.all([data.streamed.gadsStatus, data.streamed.providers]).then(([gads, providers]) => {
			gadsConnected = gads.connected
			llmConnected = providers.length > 0
			statusLoading = false
		})
	})

	function localTime(utcHour: number): string {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const d = new Date()
		d.setUTCHours(utcHour, 0, 0, 0)
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
	}

	function weeklyLocalSchedule(utcHour: number): string {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const d = new Date()
		const daysUntilMonday = (1 - d.getUTCDay() + 7) % 7 || 7
		d.setUTCDate(d.getUTCDate() + daysUntilMonday)
		d.setUTCHours(utcHour, 0, 0, 0)
		const day = d.toLocaleDateString([], { weekday: 'long' })
		const time = d.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			timeZoneName: 'short'
		})
		return `Every ${day} at ${time}`
	}

	const existingCfg = untrack(() => data.brand.ads_monitoring)

	let syncEnabled = $state(existingCfg?.sync_enabled ?? false)
	let aiReportDaily = $state(existingCfg?.ai_report_daily ?? false)
	let aiReportWeekly = $state(existingCfg?.ai_report_weekly ?? false)
	let aiReportMonthly = $state(existingCfg?.ai_report_monthly ?? false)
	let adjustmentsEnabled = $state(existingCfg?.adjustments_enabled ?? false)
	let maxIncreasePct = $state(existingCfg?.max_increase_pct ?? 20)
	let maxIncreaseBRL = $state(existingCfg?.max_increase_brl ?? 50)
	let maxDecreasePct = $state(existingCfg?.max_decrease_pct ?? 10)
	let maxDecreaseBRL = $state(existingCfg?.max_decrease_brl ?? 20)
	let suggestionsEnabled = $state(existingCfg?.suggestions_enabled ?? false)
	let minCampaignAgeDays = $state(existingCfg?.min_campaign_age_days ?? 14)
	let adjustmentIntervalDays = $state(existingCfg?.adjustment_interval_days ?? 7)

	let aggressiveWarning = $derived(minCampaignAgeDays < 10 || adjustmentIntervalDays < 5)

	let isSavingAds = $state(false)
	let savedAds = $state(false)
	let adsError = $state<string | null>(null)

	async function saveAdsConfig() {
		adsError = null
		isSavingAds = true
		try {
			const merged: AdsMonitoringConfig = {
				...(existingCfg ?? {
					target_cpa_brl: 0,
					no_conversion_alert_days: 0,
					max_cpa_multiplier: 0,
					min_daily_impressions: 0,
					budget_underpace_threshold: 0
				}),
				sync_enabled: syncEnabled,
				ai_report_daily: aiReportDaily,
				ai_report_weekly: aiReportWeekly,
				ai_report_monthly: aiReportMonthly,
				adjustments_enabled: adjustmentsEnabled,
				max_increase_pct: maxIncreasePct,
				max_increase_brl: maxIncreaseBRL,
				max_decrease_pct: maxDecreasePct,
				max_decrease_brl: maxDecreaseBRL,
				suggestions_enabled: suggestionsEnabled,
				min_campaign_age_days: minCampaignAgeDays,
				adjustment_interval_days: adjustmentIntervalDays
			}
			await updateTenant(data.tenant, { ads_monitoring: merged })
			savedAds = true
			setTimeout(() => (savedAds = false), 2500)
		} catch (err) {
			adsError = err instanceof Error ? err.message : m['globals:error_generic']()
		} finally {
			isSavingAds = false
		}
	}

	const existingPrompts = untrack(() => data.brand.report_prompts)

	let promptInstant = $state(existingPrompts?.instant ?? '')
	let promptDaily = $state(existingPrompts?.daily ?? '')
	let promptWeekly = $state(existingPrompts?.weekly ?? '')
	let promptMonthly = $state(existingPrompts?.monthly ?? '')

	let isSavingPrompts = $state(false)
	let savedPrompts = $state(false)
	let promptsError = $state<string | null>(null)
	let helpOpen = $state(false)

	async function savePrompts() {
		promptsError = null
		isSavingPrompts = true
		try {
			const prompts: ReportPrompts = {
				instant: promptInstant.trim() || undefined,
				daily: promptDaily.trim() || undefined,
				weekly: promptWeekly.trim() || undefined,
				monthly: promptMonthly.trim() || undefined
			}
			await updateTenant(data.tenant, { report_prompts: prompts })
			savedPrompts = true
			setTimeout(() => (savedPrompts = false), 2500)
		} catch (err) {
			promptsError = err instanceof Error ? err.message : m['globals:error_generic']()
		} finally {
			isSavingPrompts = false
		}
	}

	function resetPrompt(type: keyof typeof DEFAULT_PROMPTS) {
		if (type === 'instant') promptInstant = ''
		else if (type === 'daily') promptDaily = ''
		else if (type === 'weekly') promptWeekly = ''
		else promptMonthly = ''
	}

	const promptFields = $derived([
		{
			key: 'instant' as const,
			label: m['settings:prompt_instant_label'](),
			placeholder: DEFAULT_PROMPTS.instant,
			value: promptInstant,
			set: (v: string) => (promptInstant = v)
		},
		{
			key: 'daily' as const,
			label: m['settings:prompt_daily_label'](),
			placeholder: DEFAULT_PROMPTS.daily,
			value: promptDaily,
			set: (v: string) => (promptDaily = v)
		},
		{
			key: 'weekly' as const,
			label: m['settings:prompt_weekly_label'](),
			placeholder: DEFAULT_PROMPTS.weekly,
			value: promptWeekly,
			set: (v: string) => (promptWeekly = v)
		},
		{
			key: 'monthly' as const,
			label: m['settings:prompt_monthly_label'](),
			placeholder: DEFAULT_PROMPTS.monthly,
			value: promptMonthly,
			set: (v: string) => (promptMonthly = v)
		}
	])
</script>

<div class="py-8">
	<Container class="space-y-8 lg:space-y-16">
		{#if statusLoading}
			<div
				class="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900"
			>
				<div class="mb-2 h-4 w-48 rounded bg-slate-200 dark:bg-slate-700"></div>
				<div class="h-3 w-80 rounded bg-slate-100 dark:bg-slate-800"></div>
			</div>
		{:else if !gadsConnected}
			<div
				class="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800/40 dark:bg-amber-900/10"
			>
				<p class="text-sm font-medium text-amber-800 dark:text-amber-300">
					{m['settings:gads_no_integration']()}
				</p>
				<p class="mt-1 text-sm text-amber-700 dark:text-amber-400">
					<!-- i18n message renders an anchor — content from translation strings, not user input -->
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html m['settings:gads_no_integration_desc']({
						link: `<a href="/${data.tenant}/integrations" class="underline">${m['settings:gads_integrations_link']()}</a>`
					})}
				</p>
			</div>
		{:else}
			<!-- Data Sync -->
			<CardAside
				title={m['settings:data_sync_title']()}
				description={m['settings:data_sync_desc']()}
			>
				{#snippet header()}
					<div class="flex items-end justify-between gap-4">
						<CardHeader
							title={m['settings:sync_toggle_label']()}
							subtitle={m['settings:sync_toggle_desc']()}
						/>
						<Switch.Root
							bind:checked={syncEnabled}
							class="group inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700"
						>
							<Switch.Thumb
								class="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
							/>
						</Switch.Root>
					</div>
				{/snippet}

				{#if llmConnected}
					<div class="space-y-4 lg:space-y-6">
						<CardContent>
							<h3>{m['settings:ai_reports_title']()}</h3>
							<p>{m['settings:ai_reports_desc']()}</p>
						</CardContent>

						<div class="flex flex-col gap-3">
							<CheckboxCard
								bind:checked={aiReportDaily}
								title={m['settings:report_daily_title']()}
								description={m['settings:report_daily_desc']({ time: localTime(6) })}
							/>
							<CheckboxCard
								bind:checked={aiReportWeekly}
								title={m['settings:report_weekly_title']()}
								description={m['settings:report_weekly_desc']({ schedule: weeklyLocalSchedule(6) })}
							/>
							<CheckboxCard
								bind:checked={aiReportMonthly}
								title={m['settings:report_monthly_title']()}
								description={m['settings:report_monthly_desc']({ time: localTime(6) })}
							/>
						</div>
					</div>
				{/if}

				{#if adsError}
					<p
						class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
					>
						{adsError}
					</p>
				{/if}

				{#snippet footer()}
					<SaveButton isSaving={isSavingAds} saved={savedAds} onclick={saveAdsConfig} />
				{/snippet}
			</CardAside>

			<!-- Report Prompts -->
			{#if llmConnected}
				<CardAside>
					{#snippet aside()}
						<div class="flex items-center gap-2">
							<h2 class="text-text text-base font-semibold">
								{m['settings:report_prompts_title']()}
							</h2>
							<button
								type="button"
								onclick={() => (helpOpen = true)}
								class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
								aria-label={m['settings:report_prompts_help_aria']()}
							>
								<CircleQuestionMark class="h-4 w-4" />
							</button>
						</div>
						<p class="text-text/70 mt-1 text-sm">
							{m['settings:report_prompts_desc']({ param: '[brand_name]' })}
						</p>
					{/snippet}

					<div class="flex flex-col gap-6">
						{#each promptFields as field (field.key)}
							<div>
								<div class="mb-1.5 flex items-center justify-between">
									<label
										for={`prompt-${field.key}`}
										class="text-xs font-semibold tracking-wide text-slate-500 uppercase"
										>{field.label}</label
									>
									{#if field.value.trim()}
										<button
											type="button"
											onclick={() => resetPrompt(field.key)}
											class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
										>
											{m['settings:reset_to_default']()}
										</button>
									{/if}
								</div>
								<textarea
									id={`prompt-${field.key}`}
									rows={10}
									value={field.value}
									oninput={(e) => field.set((e.target as HTMLTextAreaElement).value)}
									placeholder={field.placeholder}
									class="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
								></textarea>
							</div>
						{/each}
					</div>

					{#if promptsError}
						<p
							class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
						>
							{promptsError}
						</p>
					{/if}

					{#snippet footer()}
						<SaveButton
							isSaving={isSavingPrompts}
							saved={savedPrompts}
							onclick={savePrompts}
							text={m['settings:save_prompts']()}
						/>
					{/snippet}
				</CardAside>
			{/if}

			<!-- Campaign Adjustments -->
			<CardAside
				title={m['settings:campaign_adj_title']()}
				description={m['settings:campaign_adj_desc']()}
			>
				{#snippet header()}
					<div class="flex items-end justify-between gap-4">
						<CardHeader
							title={m['settings:campaign_adj_toggle_label']()}
							subtitle={m['settings:campaign_adj_toggle_desc']()}
						/>
						<Switch.Root
							bind:checked={adjustmentsEnabled}
							class="group inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700"
						>
							<Switch.Thumb
								class="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
							/>
						</Switch.Root>
					</div>
				{/snippet}

				{#if adjustmentsEnabled}
					<div class="grid grid-cols-2 gap-4">
						<NumberField
							id="adj-inc-pct"
							label={m['settings:field_max_increase_pct']()}
							suffix="%"
							max={100}
							bind:value={maxIncreasePct}
						/>
						<NumberField
							id="adj-inc-brl"
							label={m['settings:field_max_increase_brl']()}
							suffix="R$"
							bind:value={maxIncreaseBRL}
						/>
						<NumberField
							id="adj-dec-pct"
							label={m['settings:field_max_decrease_pct']()}
							suffix="%"
							max={100}
							bind:value={maxDecreasePct}
						/>
						<NumberField
							id="adj-dec-brl"
							label={m['settings:field_max_decrease_brl']()}
							suffix="R$"
							bind:value={maxDecreaseBRL}
						/>
					</div>

					<SaveButton
						isSaving={isSavingAds}
						saved={savedAds}
						onclick={saveAdsConfig}
						class="mt-4"
					/>
				{:else}
					<span class="text-sm text-slate-500 dark:text-slate-400"> Enable to edit. </span>
				{/if}
			</CardAside>

			<!-- Automatic Adjustments -->
			<CardAside title={m['settings:auto_adj_title']()} description={m['settings:auto_adj_desc']()}>
				{#snippet header()}
					<div class="flex items-end justify-between gap-4">
						<CardHeader
							title={m['settings:auto_adj_suggestions_label']()}
							subtitle={m['settings:auto_adj_suggestions_desc']()}
						/>
						<Switch.Root
							bind:checked={suggestionsEnabled}
							class="group inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700"
						>
							<Switch.Thumb
								class="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
							/>
						</Switch.Root>
					</div>
				{/snippet}

				<div class="space-y-5">
					<div>
						<NumberField
							id="min-campaign-age"
							label={m['settings:auto_adj_min_age_label']()}
							suffix={m['settings:auto_adj_days_suffix']()}
							bind:value={minCampaignAgeDays}
						/>
						<div class="mt-2 flex gap-1.5">
							{#each [7, 14, 21, 30] as preset}
								<button
									type="button"
									onclick={() => (minCampaignAgeDays = preset)}
									class="rounded border px-2 py-0.5 text-xs font-medium transition-colors {minCampaignAgeDays ===
									preset
										? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
										: 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}"
									>{preset}d</button
								>
							{/each}
						</div>
					</div>

					<div>
						<NumberField
							id="adjustment-interval"
							label={m['settings:auto_adj_interval_label']()}
							suffix={m['settings:auto_adj_days_suffix']()}
							bind:value={adjustmentIntervalDays}
						/>
						<div class="mt-2 flex gap-1.5">
							{#each [3, 7, 14] as preset}
								<button
									type="button"
									onclick={() => (adjustmentIntervalDays = preset)}
									class="rounded border px-2 py-0.5 text-xs font-medium transition-colors {adjustmentIntervalDays ===
									preset
										? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
										: 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}"
									>{preset}d</button
								>
							{/each}
						</div>
					</div>

					{#if aggressiveWarning}
						<p
							class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
						>
							{m['settings:auto_adj_aggressive_warning']()}
						</p>
					{/if}
				</div>

				{#snippet footer()}
					<SaveButton isSaving={isSavingAds} saved={savedAds} onclick={saveAdsConfig} />
				{/snippet}
			</CardAside>
		{/if}
	</Container>
</div>

<!-- Parameters help modal -->
<Dialog.Root bind:open={helpOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/50" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
		>
			<Dialog.Title class="mb-1 text-base font-semibold text-slate-900 dark:text-white"
				>{m['settings:params_modal_title']()}</Dialog.Title
			>
			<Dialog.Description class="mb-4 text-sm text-slate-500 dark:text-slate-400">
				{m['settings:params_modal_desc']()}
			</Dialog.Description>

			<div class="divide-y divide-slate-100 dark:divide-slate-800">
				{#each PROMPT_PARAMS as param (param.key)}
					<div class="flex items-start gap-3 py-3">
						<code
							class="shrink-0 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-indigo-600 dark:bg-slate-800 dark:text-indigo-400"
							>{param.key}</code
						>
						<div>
							<p class="text-sm text-slate-700 dark:text-slate-300">{param.description}</p>
							<p class="text-xs text-slate-400">
								{m['settings:params_modal_example']({ example: param.example })}
							</p>
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-5 flex justify-end">
				<Dialog.Close
					class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
				>
					{m['settings:params_modal_close']()}
				</Dialog.Close>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
