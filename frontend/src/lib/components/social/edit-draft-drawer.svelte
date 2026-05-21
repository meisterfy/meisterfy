<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import { X, Trash2, ImagePlus } from 'lucide-svelte'
	import type { PostShape, PostPlatform } from '$lib/social'
	import { normPlatforms } from '$lib/social'
	import Drawer from '$lib/components/ui/drawer/drawer.svelte'
	import ConfirmDialog from '$lib/components/ui/dialog/confirm-dialog.svelte'
	import StatusBadge from '$lib/components/ui/status-badge/status-badge.svelte'
	import PlatformSelect from '$lib/components/ui/platform-select/platform-select.svelte'
	import { updatePost, deletePost as apiDeletePost } from '$lib/api/posts'
	import { uploadMedia, deleteMedia } from '$lib/api/media'
	import { parseHashtags } from '$lib/utils/hashtags'
	import { inputCls, labelCls } from './styles'

	let {
		open = $bindable(false),
		draft = null,
		tenant,
		onSaved,
		onDeleted
	}: {
		open: boolean
		draft: PostShape | null
		tenant: string
		onSaved: (updated: PostShape) => void
		onDeleted: (id: string) => void
	} = $props()

	let editTitle = $state('')
	let editContent = $state('')
	let editHashtags = $state('')
	let editPlatforms = $state<PostPlatform[]>([])
	let editMediaFiles = $state<string[]>([])
	let isSaving = $state(false)
	let isUploadingMedia = $state(false)
	let showDeleteConfirm = $state(false)
	let isDeletingPost = $state(false)

	$effect(() => {
		if (open && draft) {
			editTitle = draft.title
			editContent = draft.content
			editHashtags = draft.hashtags?.join(' ') ?? ''
			editPlatforms = normPlatforms(draft.platform)
			editMediaFiles = [...(draft.media_files ?? [])]
		}
	})

	async function saveEdit() {
		if (!draft || !editTitle.trim() || !editContent.trim()) return
		isSaving = true
		try {
			const tags = parseHashtags(editHashtags)
			await updatePost(tenant, draft.id, {
				title: editTitle,
				content: editContent,
				hashtags: tags,
				platforms: editPlatforms
			})
			onSaved({
				...draft,
				title: editTitle,
				content: editContent,
				hashtags: tags,
				platform: editPlatforms,
				media_files: editMediaFiles
			})
			open = false
		} finally {
			isSaving = false
		}
	}

	async function handleMediaUpload(event: Event) {
		if (!draft) return
		const input = event.target as HTMLInputElement
		const files = input.files
		if (!files || files.length === 0) return
		isUploadingMedia = true
		try {
			const urls = await uploadMedia(tenant, draft.id, files)
			editMediaFiles = urls
			input.value = ''
		} finally {
			isUploadingMedia = false
		}
	}

	async function removeMedia() {
		if (!draft) return
		await deleteMedia(tenant, draft.id)
		editMediaFiles = []
	}

	async function confirmDelete() {
		if (!draft) return
		isDeletingPost = true
		try {
			await apiDeletePost(tenant, draft.id)
			onDeleted(draft.id)
			open = false
			showDeleteConfirm = false
		} finally {
			isDeletingPost = false
		}
	}
</script>

<Drawer bind:open>
	<div class="flex h-full flex-col">
		{#if draft}
			<div
				class="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800"
			>
				<div class="min-w-0 flex-1 pr-4">
					<div class="mb-1 flex flex-wrap items-center gap-2">
						<StatusBadge status={draft.status} />
						{#if draft.media_type}
							<span
								class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 uppercase dark:bg-slate-800"
								>{draft.media_type}</span
							>
						{/if}
						{#if draft.workflow?.strategy?.framework}
							<span
								class="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
								>{draft.workflow.strategy.framework}</span
							>
						{/if}
					</div>
					<p class="truncate font-mono text-xs text-slate-400">{draft.id}</p>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					<button
						onclick={() => (showDeleteConfirm = true)}
						class="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
					>
						<Trash2 class="h-3.5 w-3.5" /> Delete
					</button>
					<button
						onclick={() => (open = false)}
						class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
					>
						<X class="h-5 w-5" />
					</button>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto px-6 py-5">
				{#if draft.workflow?.strategy?.reasoning}
					<div
						class="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50"
					>
						<p class="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
							{m['social-media:strategy_reasoning']()}
						</p>
						<p class="text-sm leading-relaxed text-slate-600 italic dark:text-slate-400">
							{draft.workflow.strategy.reasoning}
						</p>
					</div>
				{/if}
				<div class="flex flex-col gap-4">
					<div>
						<label for="edit-title" class={labelCls}>Title</label>
						<input id="edit-title" bind:value={editTitle} type="text" class={inputCls} />
					</div>
					<div>
						<label for="edit-content" class={labelCls}>Content</label>
						<textarea
							id="edit-content"
							bind:value={editContent}
							rows="8"
							class="{inputCls} resize-y"
						></textarea>
					</div>
					<div>
						<label for="edit-hashtags" class={labelCls}
							>Hashtags <span class="font-normal text-slate-400 normal-case">{m['social-media:hashtags_hint']()}</span
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
						<p class={labelCls}>Platform</p>
						<PlatformSelect bind:value={editPlatforms} />
					</div>
					<div>
						<div class="mb-1.5 flex items-center justify-between">
							<p class={labelCls}>Image</p>
							{#if editMediaFiles.length > 0}
								<button
									onclick={removeMedia}
									class="flex items-center gap-1 text-xs text-red-500 transition-colors hover:text-red-700"
								>
									<Trash2 class="h-3 w-3" /> {m['social-media:media_remove_all']()}
								</button>
							{/if}
						</div>
						{#if editMediaFiles.length > 0}
							<div
								class="mb-3 grid gap-2 {editMediaFiles.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}"
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
								<ImagePlus class="mr-2 h-4 w-4" /> {m['social-media:no_image_attached']()}
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
			</div>

			<div class="flex shrink-0 gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
				<button
					onclick={saveEdit}
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
	</div>
</Drawer>

<ConfirmDialog
	bind:open={showDeleteConfirm}
	title={m['social-media:delete_draft_title']()}
	description={draft ? `"${draft.title}" will be permanently removed.` : ''}
	isLoading={isDeletingPost}
	onconfirm={confirmDelete}
/>
