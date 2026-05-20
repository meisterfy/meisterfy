<script lang="ts">
	import { untrack } from 'svelte'
	import { Switch } from 'bits-ui'
	import { Share2, Plus, Trash2 } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'
	import type { PageData } from './$types'
	import type { ConnectorResource } from '$lib/api/social-accounts'
	import { removeMetaPage } from '$lib/api/social-accounts'
	import CardAside from '$lib/components/ui/card/card-aside.svelte'
	import CardHeader from '$lib/components/ui/card/card-header.svelte'
	import CardContent from '$lib/components/ui/card/card-content.svelte'
	import Container from '$lib/components/ui/container/container.svelte'
	import { SaveButton } from '$lib/components/ui/button'
	import { CheckboxCard } from '$lib/components/ui/checkbox'
	import MetaPagePicker from '$lib/components/social/meta-page-picker.svelte'

	let { data } = $props<{ data: PageData }>()

	let connectedPages = $state<ConnectorResource[]>([])
	let pagesLoading = $state(true)

	$effect(() => {
		pagesLoading = true
		data.connectedPages.then((pages: ConnectorResource[]) => {
			connectedPages = pages
			pagesLoading = false
		})
	})

	let pickerOpen = $state(false)
	let removingId = $state<string | null>(null)
	let removeError = $state<string | null>(null)

	function onPageAdded(resource: ConnectorResource) {
		connectedPages = [...connectedPages, resource]
	}

	async function removePage(resource: ConnectorResource) {
		removingId = resource.id
		removeError = null
		try {
			await removeMetaPage(data.tenant, resource.id)
			connectedPages = connectedPages.filter((p) => p.id !== resource.id)
		} catch (err) {
			removeError = err instanceof Error ? err.message : m['globals:error_generic']()
		} finally {
			removingId = null
		}
	}

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

	let syncInsights = $state(false)
	let aiReportDaily = $state(false)
	let aiReportWeekly = $state(false)
	let aiReportMonthly = $state(false)

	let isSaving = $state(false)
	let saved = $state(false)
	let saveError = $state<string | null>(null)

	async function saveMonitoring() {
		isSaving = true
		saveError = null
		try {
			await new Promise((r) => setTimeout(r, 300))
			saved = true
			setTimeout(() => (saved = false), 2500)
		} finally {
			isSaving = false
		}
	}
</script>

<div class="py-8">
	<Container class="space-y-8 lg:space-y-16">
		<!-- Social Accounts -->
		<CardAside
			title={m['settings:social_accounts_title']()}
			description={m['settings:social_accounts_desc']()}
		>
			<div class="space-y-6">
				<!-- Meta -->
				<div>
					<div class="mb-3 flex items-center gap-2">
						<span
							class="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
							>Meta</span
						>
						{#if connectedPages.length > 0}
							<span
								class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"
							>
								{m['settings:social_meta_connected']()}
							</span>
						{/if}
					</div>

					{#if pagesLoading}
						<div class="space-y-2">
							{#each [1, 2] as i (i)}
								<div
									class="animate-pulse rounded-lg border border-slate-100 p-3 dark:border-slate-800"
								>
									<div class="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700"></div>
								</div>
							{/each}
						</div>
					{:else if connectedPages.length > 0}
						<ul
							class="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700"
						>
							{#each connectedPages as resource (resource.id)}
								{@const igUsername = resource.metadata?.ig_username as string | null}
								<li class="flex items-center gap-3 p-3">
									<div class="flex shrink-0 items-center gap-1">
										{#if igUsername}
											<span
												class="rounded bg-pink-100 px-1.5 py-0.5 text-[10px] font-bold text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
												>IG</span
											>
										{/if}
										<span
											class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
											>FB</span
										>
									</div>

									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium text-slate-900 dark:text-white">
											{resource.resource_name ?? resource.resource_id}
										</p>
										{#if igUsername}
											<p class="text-xs text-slate-500 dark:text-slate-400">@{igUsername}</p>
										{/if}
									</div>

									<button
										type="button"
										disabled={removingId === resource.id}
										onclick={() => removePage(resource)}
										class="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-900/20"
										aria-label={m['settings:social_remove']()}
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</li>
							{/each}
						</ul>
					{/if}

					{#if removeError}
						<p
							class="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
						>
							{removeError}
						</p>
					{/if}

					<button
						type="button"
						onclick={() => (pickerOpen = true)}
						class="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-600 dark:hover:text-indigo-400"
					>
						<Plus class="h-4 w-4" />
						{m['settings:social_meta_add']()}
					</button>
				</div>

				<!-- LinkedIn -->
				<div
					class="flex items-center justify-between rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50"
				>
					<div class="flex items-center gap-3">
						<span class="rounded bg-blue-700 px-1.5 py-0.5 text-[10px] font-bold text-white"
							>in</span
						>
						<span class="text-sm font-medium text-slate-700 dark:text-slate-300">LinkedIn</span>
					</div>
					<span
						class="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-400"
					>
						{m['settings:social_coming_soon']()}
					</span>
				</div>

				<!-- X / Twitter -->
				<div
					class="flex items-center justify-between rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50"
				>
					<div class="flex items-center gap-3">
						<Share2 class="h-5 w-5 text-slate-800 dark:text-slate-200" />
						<span class="text-sm font-medium text-slate-700 dark:text-slate-300">X</span>
					</div>
					<span
						class="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-400"
					>
						{m['settings:social_coming_soon']()}
					</span>
				</div>
			</div>
		</CardAside>

		<!-- Monitoring -->
		<CardAside
			title={m['settings:social_monitoring_title']()}
			description={m['settings:social_monitoring_desc']()}
		>
			{#snippet header()}
				<div class="flex items-end justify-between gap-4">
					<CardHeader
						title={m['settings:social_sync_insights_label']()}
						subtitle={m['settings:social_sync_insights_desc']()}
					/>
					<Switch.Root
						bind:checked={syncInsights}
						class="group inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700"
					>
						<Switch.Thumb
							class="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
						/>
					</Switch.Root>
				</div>
			{/snippet}

			<div class="space-y-4">
				<p
					class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-400"
				>
					{m['settings:social_monitoring_beta_note']()}
				</p>

				<CardContent>
					<h3>{m['settings:social_ai_reports_title']()}</h3>
					<p>{m['settings:social_ai_reports_desc']()}</p>
				</CardContent>

				<div class="flex flex-col gap-3">
					<CheckboxCard
						bind:checked={aiReportDaily}
						title={m['settings:social_report_daily_title']()}
						description={m['settings:social_report_daily_desc']({ time: localTime(6) })}
					/>
					<CheckboxCard
						bind:checked={aiReportWeekly}
						title={m['settings:social_report_weekly_title']()}
						description={m['settings:social_report_weekly_desc']({
							schedule: weeklyLocalSchedule(6)
						})}
					/>
					<CheckboxCard
						bind:checked={aiReportMonthly}
						title={m['settings:social_report_monthly_title']()}
						description={m['settings:social_report_monthly_desc']({ time: localTime(6) })}
					/>
				</div>

				{#if saveError}
					<p
						class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
					>
						{saveError}
					</p>
				{/if}
			</div>

			{#snippet footer()}
				<SaveButton {isSaving} {saved} onclick={saveMonitoring} />
			{/snippet}
		</CardAside>
	</Container>
</div>

<MetaPagePicker bind:open={pickerOpen} tenant={data.tenant} onAdded={onPageAdded} />
