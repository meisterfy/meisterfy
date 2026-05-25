<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import { X, Clock } from 'lucide-svelte'
	import type { PostShape, PostPlatform } from '$lib/social'
	import { normPlatforms } from '$lib/social'
	import Drawer from '$lib/components/ui/drawer/drawer.svelte'
	import PlatformSelect from '$lib/components/ui/platform-select/platform-select.svelte'
	import { updatePost, updatePostStatus } from '$lib/api/posts'
	import { getConnectedMetaPages, type ConnectedMetaPage } from '$lib/api/social-accounts'
	import { inputCls, labelCls } from './styles'

	let {
		open = $bindable(false),
		draft = null,
		tenant,
		onScheduled
	}: {
		open: boolean
		draft: PostShape | null
		tenant: string
		onScheduled: (id: string) => void
	} = $props()

	let schedDate = $state('')
	let schedTime = $state('10:00')
	let schedPlatforms = $state<PostPlatform[]>(['instagram_feed'])
	let isSaving = $state(false)
	let metaPages = $state<ConnectedMetaPage[]>([])
	let metaPagesLoaded = $state(false)
	let selectedResourceId = $state<string>('')

	$effect(() => {
		if (open && draft) {
			schedDate = ''
			schedTime = '10:00'
			const draftPlatforms = normPlatforms(draft.platform)
			schedPlatforms = draftPlatforms.length > 0 ? draftPlatforms : ['instagram_feed']
			selectedResourceId = draft.connector_resource_id ?? ''
			if (!metaPagesLoaded) {
				getConnectedMetaPages(tenant)
					.then((pages) => {
						metaPages = pages
						metaPagesLoaded = true
					})
					.catch(() => {
						metaPagesLoaded = true
					})
			}
		}
	})

	async function saveSchedule() {
		if (!draft || !schedDate) return
		isSaving = true
		try {
			await updatePost(tenant, draft.id, {
				platforms: schedPlatforms,
				connector_resource_id: selectedResourceId || null
			})
			await updatePostStatus(tenant, draft.id, 'scheduled', {
				scheduled_date: schedDate,
				scheduled_time: schedTime || undefined
			})
			onScheduled(draft.id)
			open = false
		} finally {
			isSaving = false
		}
	}
</script>

<Drawer bind:open>
	<div class="flex h-full flex-col">
		{#if draft}
			<div
				class="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800"
			>
				<div class="min-w-0 flex-1 pr-4">
					<h2 class="text-lg font-bold text-slate-900 dark:text-white">
						{m['social-media:schedule_title']()}
					</h2>
					<p class="truncate text-sm text-slate-500">{draft.title}</p>
				</div>
				<button
					onclick={() => (open = false)}
					class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
				>
					<X class="h-5 w-5" />
				</button>
			</div>
			<div class="flex-1 overflow-y-auto px-6 py-5">
				<div class="flex flex-col gap-4">
					<div>
						<p class={labelCls}>Platform</p>
						<PlatformSelect bind:value={schedPlatforms} />
					</div>
					{#if metaPages.length > 0}
						<div>
							<label for="sched-meta-account" class={labelCls}
								>{m['social-media:meta_account_label']()}</label
							>
							<select id="sched-meta-account" bind:value={selectedResourceId} class={inputCls}>
								<option value="">{m['social-media:meta_account_none']()}</option>
								{#each metaPages as page (page.id)}
									<option value={page.id}>
										{page.resource_name ?? 'Page'}{page.metadata.ig_username
											? ` (@${page.metadata.ig_username})`
											: ' (Facebook only)'}
									</option>
								{/each}
							</select>
						</div>
					{:else if metaPagesLoaded}
						<p class="text-xs text-slate-400">
							{m['social-media:meta_connect_hint']()}
						</p>
					{/if}
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="sched-date" class={labelCls}>Date</label>
							<input
								id="sched-date"
								type="date"
								bind:value={schedDate}
								min={new Date().toISOString().slice(0, 10)}
								class={inputCls}
							/>
						</div>
						<div>
							<label for="sched-time" class={labelCls}
								>Time <span class="font-normal text-slate-400 normal-case">(opt.)</span></label
							>
							<input id="sched-time" type="time" bind:value={schedTime} class={inputCls} />
						</div>
					</div>
				</div>
			</div>
			<div class="flex shrink-0 gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
				<button
					onclick={saveSchedule}
					disabled={!schedDate || isSaving}
					class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
				>
					<Clock class="h-4 w-4" />
					{isSaving ? 'Saving…' : 'Add to Planner'}
				</button>
				<button
					onclick={() => (open = false)}
					class="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
				>
					Cancel
				</button>
			</div>
		{/if}
	</div>
</Drawer>
