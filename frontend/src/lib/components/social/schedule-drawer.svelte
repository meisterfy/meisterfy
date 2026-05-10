<script lang="ts">
	import { X, Clock } from 'lucide-svelte'
	import type { PostShape, PostPlatform } from '$lib/social'
	import { normPlatforms } from '$lib/social'
	import Drawer from '$lib/components/ui/drawer/drawer.svelte'
	import PlatformSelect from '@/lib/components/ui/platform-select/platform-select.svelte'
	import { updatePost, updatePostStatus } from '$lib/api/posts'

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

	const inputCls =
		'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500'
	const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

	let schedDate = $state('')
	let schedTime = $state('10:00')
	let schedPlatforms = $state<PostPlatform[]>(['instagram_feed'])
	let isSaving = $state(false)

	$effect(() => {
		if (open && draft) {
			schedDate = ''
			schedTime = '10:00'
			schedPlatforms =
				normPlatforms(draft.platform).length > 0
					? normPlatforms(draft.platform)
					: ['instagram_feed']
		}
	})

	async function saveSchedule() {
		if (!draft || !schedDate) return
		isSaving = true
		try {
			await updatePost(tenant, draft.id, { platforms: schedPlatforms })
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
					<h2 class="text-lg font-bold text-slate-900 dark:text-white">Schedule Post</h2>
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
