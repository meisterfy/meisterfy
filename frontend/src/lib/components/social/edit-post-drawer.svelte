<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import { X, Trash2, ImagePlus } from 'lucide-svelte'
	import type { PostShape, PostPlatform } from '$lib/social'
	import { PLATFORM_CONFIG as PLATFORM, normPlatforms } from '$lib/social'
	import Drawer from '$lib/components/ui/drawer/drawer.svelte'
	import ConfirmDialog from '$lib/components/ui/dialog/confirm-dialog.svelte'
	import StatusBadge from '$lib/components/ui/status-badge/status-badge.svelte'
	import PlatformSelect from '$lib/components/ui/platform-select/platform-select.svelte'
	import ProviderIcon from '$lib/components/ui/provider-icon.svelte'
	import { updatePost, deletePost as apiDeletePost } from '$lib/api/posts'
	import { uploadMedia, deleteMedia } from '$lib/api/media'
	import { parseHashtags } from '$lib/utils/hashtags'
	import { inputCls, labelCls } from './styles'

	let {
		open = $bindable(false),
		post = null,
		tenant,
		onSaved,
		onDeleted
	}: {
		open: boolean
		post: PostShape | null
		tenant: string
		onSaved: (updated: PostShape) => void
		onDeleted: (id: string) => void
	} = $props()

	let editTitle = $state('')
	let editContent = $state('')
	let editHashtags = $state('')
	let editPlatforms = $state<PostPlatform[]>([])
	let editDate = $state('')
	let editTime = $state('')
	let editMediaFiles = $state<string[]>([])
	let isSaving = $state(false)
	let isUploadingMedia = $state(false)
	let showDeleteConfirm = $state(false)
	let isDeletingPost = $state(false)

	$effect(() => {
		if (open && post) {
			editTitle = post.title
			editContent = post.content
			editHashtags = post.hashtags?.join(' ') ?? ''
			editPlatforms = normPlatforms(post.platform)
			editDate = post.scheduled_date ?? ''
			editTime = post.scheduled_time ?? ''
			editMediaFiles = [...(post.media_files ?? [])]
		}
	})

	async function savePost() {
		if (!post || !editTitle.trim() || !editContent.trim()) return
		isSaving = true
		try {
			const tags = parseHashtags(editHashtags)
			await updatePost(tenant, post.id, {
				title: editTitle,
				content: editContent,
				hashtags: tags,
				platforms: editPlatforms,
				scheduled_date: editDate || undefined,
				scheduled_time: editTime || undefined
			})
			onSaved({
				...post,
				title: editTitle,
				content: editContent,
				hashtags: tags,
				platform: editPlatforms,
				scheduled_date: editDate || undefined,
				scheduled_time: editTime || undefined,
				media_files: editMediaFiles
			})
			open = false
		} finally {
			isSaving = false
		}
	}

	async function handleMediaUpload(event: Event) {
		if (!post) return
		const input = event.target as HTMLInputElement
		const files = input.files
		if (!files || files.length === 0) return
		isUploadingMedia = true
		try {
			const urls = await uploadMedia(tenant, post.id, files)
			editMediaFiles = urls
			input.value = ''
		} finally {
			isUploadingMedia = false
		}
	}

	async function removeMedia() {
		if (!post) return
		await deleteMedia(tenant, post.id)
		editMediaFiles = []
	}

	async function confirmDelete() {
		if (!post) return
		isDeletingPost = true
		try {
			await apiDeletePost(tenant, post.id)
			onDeleted(post.id)
			open = false
			showDeleteConfirm = false
		} catch {
			// ignore
		} finally {
			isDeletingPost = false
		}
	}
</script>

<Drawer bind:open>
	<div class="flex h-full flex-col">
		{#if post}
			<div
				class="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800"
			>
				<div class="min-w-0 flex-1 pr-4">
					<div class="mb-1 flex flex-wrap items-center gap-2">
						<StatusBadge status={post.status} />
						{#each normPlatforms(post.platform) as plt (plt)}
							{#if PLATFORM[plt]}
								<span class="flex items-center gap-1 text-xs text-slate-500">
									<ProviderIcon provider={plt} class="h-2.5 w-2.5 shrink-0" />
									{PLATFORM[plt].label}
								</span>
							{/if}
						{/each}
					</div>
					<p class="truncate font-mono text-xs text-slate-400">{post.id}</p>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					{#if post.status !== 'published'}
						<button
							onclick={() => (showDeleteConfirm = true)}
							class="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
						>
							<Trash2 class="h-3.5 w-3.5" /> Delete
						</button>
					{/if}
					<button
						onclick={() => (open = false)}
						class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
					>
						<X class="h-5 w-5" />
					</button>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto px-6 py-5">
				{#if post.status === 'published'}
					<p class="mb-2 font-bold text-slate-900 dark:text-white">{post.title}</p>
					{#if post.scheduled_date}
						<p class="mb-3 text-xs text-slate-400">
							{post.scheduled_date}{post.scheduled_time ? ' · ' + post.scheduled_time : ''}
						</p>
					{/if}
					{#if editMediaFiles.length > 0}
						<div
							class="mb-4 grid gap-2 {editMediaFiles.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}"
						>
							{#each editMediaFiles as f (f)}
								<div
									class="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700"
								>
									{#if f.match(/\.(mp4|webm)$/i)}
										<video
											src="/api/media/{tenant}/{f}"
											controls
											class="max-h-full max-w-full object-contain"><track kind="captions" /></video
										>
									{:else}
										<img
											src="/api/media/{tenant}/{f}"
											alt="Media"
											class="max-h-full max-w-full object-contain"
										/>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
					<p
						class="mb-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300"
					>
						{post.content}
					</p>
					{#if post.hashtags?.length}
						<p class="flex flex-wrap gap-1 text-xs text-indigo-500 dark:text-indigo-400">
							{#each post.hashtags as tag (tag)}<span>{tag}</span>{/each}
						</p>
					{/if}
				{:else}
					<div class="flex flex-col gap-4">
						<div>
							<p class={labelCls}>Platform</p>
							<PlatformSelect bind:value={editPlatforms} />
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label for="edit-date" class={labelCls}>Date</label>
								<input id="edit-date" type="date" bind:value={editDate} class={inputCls} />
							</div>
							<div>
								<label for="edit-time" class={labelCls}
									>Time <span class="font-normal text-slate-400 normal-case">(opt.)</span></label
								>
								<input id="edit-time" type="time" bind:value={editTime} class={inputCls} />
							</div>
						</div>
						<div>
							<label for="edit-title" class={labelCls}>Title</label>
							<input id="edit-title" bind:value={editTitle} type="text" class={inputCls} />
						</div>
						<div>
							<label for="edit-content" class={labelCls}>Content</label>
							<textarea
								id="edit-content"
								bind:value={editContent}
								rows="7"
								class="{inputCls} resize-y"
							></textarea>
						</div>
						<div>
							<label for="edit-hashtags" class={labelCls}
								>Hashtags <span class="font-normal text-slate-400 normal-case"
									>{m['social-media:hashtags_hint']()}</span
								></label
							>
							<input id="edit-hashtags" bind:value={editHashtags} type="text" class={inputCls} />
							{#if editHashtags}
								<p class="mt-1.5 flex flex-wrap gap-1 text-xs text-indigo-500 dark:text-indigo-400">
									{#each parseHashtags(editHashtags) as tag (tag)}<span>{tag}</span>{/each}
								</p>
							{/if}
						</div>
						<div>
							<div class="mb-1.5 flex items-center justify-between">
								<p class={labelCls}>Image</p>
								{#if editMediaFiles.length > 0}
									<button
										onclick={removeMedia}
										class="flex items-center gap-1 text-xs text-red-500 transition-colors hover:text-red-700"
									>
										<Trash2 class="h-3 w-3" />
										{m['social-media:media_remove_all']()}
									</button>
								{/if}
							</div>
							{#if editMediaFiles.length > 0}
								<div
									class="mb-3 grid gap-2 {editMediaFiles.length > 1
										? 'grid-cols-2'
										: 'grid-cols-1'}"
								>
									{#each editMediaFiles as f (f)}
										<div
											class="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700"
										>
											{#if f.match(/\.(mp4|webm)$/i)}
												<video
													src="/api/media/{tenant}/{f}"
													controls
													class="max-h-full max-w-full object-contain"
													><track kind="captions" /></video
												>
											{:else}
												<img
													src="/api/media/{tenant}/{f}"
													alt="Media"
													class="max-h-full max-w-full object-contain"
												/>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<div
									class="mb-3 flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 text-xs font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800/50"
								>
									<ImagePlus class="mr-2 h-4 w-4" />
									{m['social-media:no_image_attached']()}
								</div>
							{/if}
							<input
								type="file"
								accept="image/*,video/*"
								multiple
								onchange={handleMediaUpload}
								disabled={isUploadingMedia}
								class="w-full cursor-pointer text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
							/>
							{#if isUploadingMedia}
								<p class="mt-1 animate-pulse text-xs text-indigo-600 dark:text-indigo-400">
									{m['social-media:media_uploading']()}
								</p>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			{#if post.status !== 'published'}
				<div class="flex shrink-0 gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
					<button
						onclick={savePost}
						disabled={!editTitle.trim() || !editContent.trim() || isSaving}
						class="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
					>
						{isSaving ? 'Saving…' : 'Save Changes'}
					</button>
					<button
						onclick={() => (open = false)}
						class="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
					>
						Cancel
					</button>
				</div>
			{/if}
		{/if}
	</div>
</Drawer>

<ConfirmDialog
	bind:open={showDeleteConfirm}
	title={m['social-media:delete_post_title']()}
	description={post ? `"${post.title}" will be permanently removed.` : ''}
	isLoading={isDeletingPost}
	onconfirm={confirmDelete}
/>
