<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import { X, Clock } from 'lucide-svelte'
	import type { PostShape, PostPlatform } from '$lib/social'
	import Drawer from '$lib/components/ui/drawer/drawer.svelte'
	import PlatformSelect from '$lib/components/ui/platform-select/platform-select.svelte'
	import { createPost as apiCreatePost } from '$lib/api/posts'
	import { uploadMedia } from '$lib/api/media'
	import { parseHashtags } from '$lib/utils/hashtags'
	import { normalizePost } from '$lib/utils/transforms'
	import { getConnectedMetaPages, type ConnectedMetaPage } from '$lib/api/social-accounts'
	import { inputCls, labelCls } from './styles'
	import { untrack } from 'svelte'

	let {
		open = $bindable(false),
		tenant,
		defaultDate = '',
		onCreated
	}: {
		open: boolean
		tenant: string
		defaultDate?: string
		onCreated: (post: PostShape) => void
	} = $props()

	let newTitle = $state('')
	let newContent = $state('')
	let newHashtags = $state('')
	let newTime = $state('10:00')
	let newPlatforms = $state<PostPlatform[]>(['instagram_feed'])
	let newMediaInput = $state<HTMLInputElement | null>(null)
	let isCreating = $state(false)
	let metaPages = $state<ConnectedMetaPage[]>([])
	let metaPagesLoaded = $state(false)
	let selectedResourceId = $state<string>('')

	$effect(() => {
		if (open) {
			newTitle = ''
			newContent = ''
			newHashtags = ''
			newTime = '10:00'
			newPlatforms = ['instagram_feed']
			selectedResourceId = ''
			if (!untrack(() => metaPagesLoaded)) {
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

	async function createPost() {
		if (!defaultDate || !newTitle.trim() || !newContent.trim()) return
		isCreating = true
		try {
			const tags = parseHashtags(newHashtags)
			const res = await apiCreatePost(tenant, {
				title: newTitle,
				content: newContent,
				hashtags: tags,
				platforms: newPlatforms,
				status: 'scheduled',
				scheduled_date: defaultDate,
				scheduled_time: newTime || undefined,
				connector_resource_id: selectedResourceId || null
			})
			const files = newMediaInput?.files
			let mediaFiles: string[] = []
			if (files && files.length > 0) {
				try {
					mediaFiles = await uploadMedia(tenant, res.id, files)
				} catch {
					// ignore upload errors — post was created successfully
				}
			}
			onCreated({ ...normalizePost(res), media_files: mediaFiles })
			open = false
		} finally {
			isCreating = false
		}
	}
</script>

<Drawer bind:open>
	<div class="flex h-full flex-col">
		<div
			class="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800"
		>
			<div>
				<h2 class="text-lg font-bold text-slate-900 dark:text-white">{m['social-media:post_new_title']()}</h2>
				{#if defaultDate}
					<p class="font-mono text-xs text-slate-400">{defaultDate}</p>
				{/if}
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
					<PlatformSelect bind:value={newPlatforms} />
				</div>
				{#if metaPages.length > 0}
					<div>
						<label for="new-meta-account" class={labelCls}>{m['social-media:meta_account_label']()}</label>
						<select id="new-meta-account" bind:value={selectedResourceId} class={inputCls}>
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
						<label for="new-date" class={labelCls}
							>Date <span class="font-normal text-slate-400 normal-case">(fixed)</span></label
						>
						<input
							id="new-date"
							type="date"
							value={defaultDate}
							disabled
							class="{inputCls} cursor-not-allowed opacity-60"
						/>
					</div>
					<div>
						<label for="new-time" class={labelCls}
							>Time <span class="font-normal text-slate-400 normal-case">(opt.)</span></label
						>
						<input id="new-time" type="time" bind:value={newTime} class={inputCls} />
					</div>
				</div>
				<div>
					<label for="new-title" class={labelCls}>Title</label>
					<input
						id="new-title"
						bind:value={newTitle}
						type="text"
						placeholder={m['social-media:post_title_placeholder']()}
						class={inputCls}
					/>
				</div>
				<div>
					<label for="new-content" class={labelCls}>Content</label>
					<textarea
						id="new-content"
						bind:value={newContent}
						rows="5"
						placeholder={m['social-media:post_copy_placeholder']()}
						class="{inputCls} resize-none"
					></textarea>
				</div>
				<div>
					<label for="new-hashtags" class={labelCls}
						>Hashtags <span class="font-normal text-slate-400 normal-case">{m['social-media:hashtags_hint']()}</span
						></label
					>
					<input
						id="new-hashtags"
						bind:value={newHashtags}
						type="text"
						placeholder={m['social-media:hashtag_placeholder']()}
						class={inputCls}
					/>
				</div>
				<div>
					<label for="new-image" class={labelCls}
						>Image <span class="font-normal text-slate-400 normal-case">(optional)</span></label
					>
					<input
						id="new-image"
						bind:this={newMediaInput}
						type="file"
						accept="image/*,video/*"
						multiple
						class="w-full cursor-pointer text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
					/>
				</div>
			</div>
		</div>

		<div class="flex shrink-0 gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
			<button
				onclick={createPost}
				disabled={!newTitle.trim() || !newContent.trim() || isCreating}
				class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
			>
				<Clock class="h-4 w-4" />
				{isCreating ? 'Saving…' : 'Add to Planner'}
			</button>
			<button
				onclick={() => (open = false)}
				class="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
			>
				Cancel
			</button>
		</div>
	</div>
</Drawer>
