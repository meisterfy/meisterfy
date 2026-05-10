<script lang="ts">
	import { X } from 'lucide-svelte'
	import type { PostShape } from '$lib/social'
	import Drawer from '$lib/components/ui/drawer/drawer.svelte'
	import { createPost as apiCreatePost } from '$lib/api/posts'
	import { uploadMedia } from '$lib/api/media'
	import { parseHashtags } from '$lib/utils/hashtags'

	let {
		open = $bindable(false),
		tenant,
		onCreated
	}: {
		open: boolean
		tenant: string
		onCreated: (post: PostShape) => void
	} = $props()

	const inputCls =
		'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500'
	const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

	let newTitle = $state('')
	let newContent = $state('')
	let newHashtags = $state('')
	let newMediaInput = $state<HTMLInputElement | null>(null)
	let isCreating = $state(false)

	$effect(() => {
		if (open) {
			newTitle = ''
			newContent = ''
			newHashtags = ''
		}
	})

	async function createDraft() {
		if (!newTitle.trim() || !newContent.trim()) return
		isCreating = true
		try {
			const tags = parseHashtags(newHashtags)
			const newPost = await apiCreatePost(tenant, {
				title: newTitle,
				content: newContent,
				hashtags: tags,
				status: 'draft'
			})
			const files = newMediaInput?.files
			let mediaFiles: string[] = []
			if (files && files.length > 0) {
				try {
					mediaFiles = await uploadMedia(tenant, newPost.id, files)
				} catch {
					/* ignore upload errors */
				}
			}
			onCreated({
				id: newPost.id,
				status: 'draft',
				title: newPost.title ?? newTitle,
				content: newPost.content,
				hashtags: newPost.hashtags ?? tags,
				platform: undefined,
				media_type: null,
				client_id: tenant,
				media_files: mediaFiles,
				workflow: null
			})
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
			<h2 class="text-lg font-bold text-slate-900 dark:text-white">New Draft</h2>
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
					<label for="create-title" class={labelCls}>Title</label>
					<input
						id="create-title"
						bind:value={newTitle}
						type="text"
						placeholder="Post title"
						class={inputCls}
					/>
				</div>
				<div>
					<label for="create-content" class={labelCls}>Content</label>
					<textarea
						id="create-content"
						bind:value={newContent}
						rows="5"
						placeholder="Post copy…"
						class="{inputCls} resize-none"
					></textarea>
				</div>
				<div>
					<label for="create-hashtags" class={labelCls}
						>Hashtags <span class="font-normal text-slate-400 normal-case">(space separated)</span
						></label
					>
					<input
						id="create-hashtags"
						bind:value={newHashtags}
						type="text"
						placeholder="#hashtag1 #hashtag2"
						class={inputCls}
					/>
				</div>
				<div>
					<label for="create-image" class={labelCls}
						>Image <span class="font-normal text-slate-400 normal-case">(optional)</span></label
					>
					<input
						id="create-image"
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
				onclick={createDraft}
				disabled={!newTitle.trim() || !newContent.trim() || isCreating}
				class="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
			>
				{isCreating ? 'Creating…' : 'Create Draft'}
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
