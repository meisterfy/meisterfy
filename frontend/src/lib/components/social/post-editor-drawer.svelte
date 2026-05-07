<script lang="ts">
	import { X, Clock, Trash2 } from 'lucide-svelte'
	import type { PostShape } from '$lib/social'
	import Drawer from '$lib/components/ui/drawer/drawer.svelte'
	import PlatformSelect from '$lib/components/ui/platform-select/PlatformSelect.svelte'
	import ProviderIcon from '$lib/components/ui/ProviderIcon.svelte'
	import { PLATFORM_CONFIG as PLATFORM, normPlatforms, type PostPlatform } from '$lib/social'
	import {
		updatePost,
		createPost as apiCreatePost,
		deletePost as apiDeletePost
	} from '$lib/api/posts'
	import ConfirmDialog from '$lib/components/ui/dialog/confirm-dialog.svelte'

	let {
		open = $bindable(false),
		post = null,
		tenant = '',
		initialDate = '',
		onSave = () => {},
		onDelete = () => {}
	}: {
		open: boolean
		post: PostShape | null
		tenant: string
		initialDate?: string
		onSave?: (p: PostShape) => void
		onDelete?: (id: string) => void
	} = $props()

	const inputCls =
		'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500'
	const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

	let editTitle = $state('')
	let editContent = $state('')
	let editHashtags = $state('')
	let editPlatforms = $state<PostPlatform[]>([])
	let editDate = $state('')
	let editTime = $state('')
	let editMediaFiles = $state<string[]>([])
	let isSaving = $state(false)
	let isDeleting = $state(false)
	let showDeleteConfirm = $state(false)
	let newMediaInput = $state<HTMLInputElement | null>(null)

	$effect(() => {
		if (open) {
			if (post) {
				editTitle = post.title || ''
				editContent = post.content || ''
				editHashtags = post.hashtags?.join(' ') ?? ''
				editPlatforms = normPlatforms(post.platform)
				editDate = post.scheduled_date || initialDate || ''
				editTime = post.scheduled_time || '10:00'
				editMediaFiles = [...(post.media_files || [])]
			} else {
				editTitle = ''
				editContent = ''
				editHashtags = ''
				editPlatforms = ['instagram_feed']
				editDate = initialDate || ''
				editTime = '10:00'
				editMediaFiles = []
			}
		}
	})

	async function handleSave() {
		if (!editTitle.trim() || !editContent.trim()) return
		isSaving = true
		try {
			const tags = editHashtags
				.split(/\s+/)
				.map((t) => t.trim())
				.filter(Boolean)
			let savedPost: PostShape
			let savedMedia = editMediaFiles

			if (post) {
				const id = post.filename.replace(/\.json$/, '')
				await updatePost(tenant, id, {
					title: editTitle,
					content: editContent,
					hashtags: tags,
					platforms: editPlatforms,
					scheduled_date: editDate || undefined,
					scheduled_time: editTime || undefined
				})
				savedPost = {
					...post,
					title: editTitle,
					content: editContent,
					hashtags: tags,
					platform: editPlatforms,
					scheduled_date: editDate || undefined,
					scheduled_time: editTime || undefined
				}
			} else {
				const res = await apiCreatePost(tenant, {
					title: editTitle,
					content: editContent,
					hashtags: tags,
					platforms: editPlatforms,
					status: 'scheduled',
					scheduled_date: editDate || undefined,
					scheduled_time: editTime || undefined
				})

				const files = newMediaInput?.files
				if (files && files.length > 0) {
					const fd = new FormData()
					for (let i = 0; i < files.length; i++) fd.append('file', files[i])
					const mr = await fetch(`/api/media/${tenant}/${res.id}`, { method: 'POST', body: fd })
					if (mr.ok) {
						const mb = (await mr.json()) as { media_files: string[] }
						savedMedia = mb.media_files ?? []
					}
				}

				savedPost = {
					...res,
					status: res.status,
					title: res.title ?? editTitle,
					content: res.content,
					hashtags: res.hashtags ?? [],
					media_type: res.media_type,
					scheduled_date: res.scheduled_date ?? editDate,
					scheduled_time: res.scheduled_time,
					platform: (res.platforms?.[0] as PostPlatform | undefined) ?? null,
					client_id: res.tenant_id,
					filename: res.id + '.json',
					media_files: savedMedia,
					workflow: {}
				}
			}

			onSave(savedPost)
			open = false
		} finally {
			isSaving = false
		}
	}

	async function handleDelete() {
		if (!post) return
		isDeleting = true
		try {
			const id = post.filename.replace(/\.json$/, '')
			await apiDeletePost(tenant, id)
			onDelete(id)
			open = false
			showDeleteConfirm = false
		} finally {
			isDeleting = false
		}
	}
</script>

<Drawer bind:open>
	<div class="flex h-full flex-col">
		<div
			class="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800"
		>
			<div class="min-w-0 flex-1 pr-4">
				{#if post}
					<div class="mb-1 flex flex-wrap items-center gap-2">
						<span
							class="rounded-full px-2 py-0.5 text-xs font-bold uppercase {post.status ===
							'published'
								? 'bg-emerald-100 text-emerald-700'
								: 'bg-amber-100 text-amber-700'}">{post.status}</span
						>
						{#each normPlatforms(post.platform) as plt}
							{#if PLATFORM[plt]}
								<span class="flex items-center gap-1 text-xs text-slate-500">
									<ProviderIcon provider={plt} size={10} class="h-2.5 w-2.5 shrink-0" />
									{PLATFORM[plt].label}
								</span>
							{/if}
						{/each}
					</div>
					<p class="truncate font-mono text-xs text-slate-400">{post.id}</p>
				{:else}
					<h2 class="text-lg font-bold text-slate-900 dark:text-white">New Post</h2>
					{#if initialDate}
						<p class="font-mono text-xs text-slate-400">{initialDate}</p>
					{/if}
				{/if}
			</div>

			<div class="flex shrink-0 items-center gap-2">
				{#if post && post.status !== 'published'}
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
			{#if post?.status === 'published'}
				<!-- Read-only view -->
				<p class="mb-2 font-bold text-slate-900 dark:text-white">{post.title}</p>
				{#if post.scheduled_date}
					<p class="mb-3 text-xs text-slate-400">
						{post.scheduled_date}{post.scheduled_time ? ' · ' + post.scheduled_time : ''}
					</p>
				{/if}
				<p
					class="mb-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300"
				>
					{post.content}
				</p>
			{:else}
				<!-- Editable form -->
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
							<label for="edit-time" class={labelCls}>Time</label>
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
						<label for="edit-hashtags" class={labelCls}>Hashtags</label>
						<input id="edit-hashtags" bind:value={editHashtags} type="text" class={inputCls} />
					</div>
					{#if !post}
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
					{/if}
				</div>
			{/if}
		</div>

		{#if !post || post.status !== 'published'}
			<div class="flex shrink-0 gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
				<button
					onclick={handleSave}
					disabled={!editTitle.trim() || !editContent.trim() || isSaving}
					class="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
				>
					{isSaving ? 'Saving…' : post ? 'Save Changes' : 'Add to Planner'}
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
	title="Delete post?"
	description={post ? `"${post.title}" will be permanently removed.` : ''}
	isLoading={isDeleting}
	onconfirm={handleDelete}
/>
