<script lang="ts">
	import { untrack } from 'svelte'
	import { FileEdit, Check, ImagePlus, Plus, Pencil, CalendarPlus, Send, Trash2 } from 'lucide-svelte'
	import type { PageData } from './$types'
	import { PLATFORM_CONFIG as PLATFORM, normPlatforms, type PostShape, type PostPlatform } from '$lib/social'
	import { updatePostStatus, deletePost as apiDeletePost } from '$lib/api/posts'
	import ProviderIcon from '$lib/components/ui/provider-icon.svelte'
	import StatusBadge from '$lib/components/ui/status-badge/status-badge.svelte'
	import ConfirmDialog from '$lib/components/ui/dialog/confirm-dialog.svelte'
	import CreateDraftDrawer from '$lib/components/social/create-draft-drawer.svelte'
	import EditDraftDrawer from '$lib/components/social/edit-draft-drawer.svelte'
	import ScheduleDrawer from '$lib/components/social/schedule-drawer.svelte'
	import PublishDrawer from '$lib/components/social/publish-drawer.svelte'

	let { data } = $props<{ data: PageData }>()

	let drafts = $state<PostShape[]>(untrack(() => data.drafts))
	let metaAccounts = $state(untrack(() => data.metaAccounts ?? []))

	$effect(() => {
		metaAccounts = data.metaAccounts ?? []
	})

	// ── Create ─────────────────────────────────────────────────────────────────
	let showCreate = $state(false)

	// ── Edit ───────────────────────────────────────────────────────────────────
	let showEdit = $state(false)
	let selectedForEdit = $state<PostShape | null>(null)

	// ── Schedule ───────────────────────────────────────────────────────────────
	let showSchedule = $state(false)
	let selectedForSchedule = $state<PostShape | null>(null)

	// ── Publish ────────────────────────────────────────────────────────────────
	let showPublish = $state(false)
	let selectedForPublish = $state<PostShape | null>(null)

	// ── Inline delete ──────────────────────────────────────────────────────────
	let postToDelete = $state<PostShape | null>(null)
	let showDeleteConfirm = $state(false)
	let isDeletingPost = $state(false)

	// ── Approve toggle ─────────────────────────────────────────────────────────
	let approvingId = $state<string | null>(null)

	function openEdit(draft: PostShape) {
		selectedForEdit = draft
		showEdit = true
	}

	function openSchedule(draft: PostShape) {
		selectedForSchedule = draft
		showSchedule = true
	}

	function openPublish(draft: PostShape) {
		selectedForPublish = draft
		showPublish = true
	}

	function requestDelete(post: PostShape) {
		postToDelete = post
		showDeleteConfirm = true
	}

	async function confirmDelete() {
		if (!postToDelete) return
		isDeletingPost = true
		try {
			await apiDeletePost(data.tenant, postToDelete.id)
			drafts = drafts.filter((d) => d.id !== postToDelete!.id)
			if (selectedForEdit?.id === postToDelete.id) showEdit = false
			postToDelete = null
			showDeleteConfirm = false
		} finally {
			isDeletingPost = false
		}
	}

	async function toggleApprove(post: PostShape) {
		approvingId = post.id
		const newStatus = post.status === 'approved' ? 'draft' : 'approved'
		try {
			await updatePostStatus(data.tenant, post.id, newStatus as import('$lib/api/posts').PostStatus)
			post.status = newStatus
			drafts = [...drafts]
		} finally {
			approvingId = null
		}
	}
</script>

<div class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<div class="mb-0.5 flex items-center gap-2">
				<FileEdit class="h-5 w-5 text-slate-400" />
				<h2 class="text-xl font-bold text-slate-900 dark:text-white">Drafts</h2>
				<span
					class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800"
				>
					{drafts.length}
				</span>
			</div>
			<p class="text-sm text-slate-500 dark:text-slate-400">
				Posts without a scheduled date. Approve and schedule to add to the planner.
			</p>
		</div>
		<button
			onclick={() => (showCreate = true)}
			class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
		>
			<Plus class="h-4 w-4" /> New Draft
		</button>
	</div>

	{#if drafts.length === 0}
		<div
			class="rounded-xl border-2 border-dashed border-slate-300 p-16 text-center dark:border-slate-700"
		>
			<FileEdit class="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
			<p class="mb-3 text-sm text-slate-500 dark:text-slate-400">No drafts yet.</p>
			<button
				onclick={() => (showCreate = true)}
				class="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
			>
				Create your first draft
			</button>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each drafts as post (post.id)}
				<div
					class="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
				>
					<!-- Thumbnail -->
					{#if post.media_files?.length > 0}
						<div
							class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700"
						>
							{#if post.media_files[0].match(/\.(mp4|webm)$/i)}
								<video
									src="/api/media/{data.tenant}/{post.media_files[0]}"
									class="h-full w-full object-contain"><track kind="captions" /></video
								>
							{:else}
								<img
									src="/api/media/{data.tenant}/{post.media_files[0]}"
									alt=""
									class="h-full w-full object-contain"
								/>
							{/if}
						</div>
					{:else}
						<div
							class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
						>
							<ImagePlus class="h-5 w-5 text-slate-300 dark:text-slate-600" />
						</div>
					{/if}

					<div class="min-w-0 flex-1">
						<div class="mb-2 flex flex-wrap items-center gap-2">
							<StatusBadge status={post.status} />
							{#each normPlatforms(post.platform) as plt (plt)}
								{@render PlatformBadge({ platform: plt })}
							{/each}
							<span class="truncate font-mono text-xs text-slate-400">{post.id}</span>
						</div>
						<p class="mb-1 font-semibold text-slate-900 dark:text-white">{post.title}</p>
						<p class="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{post.content}</p>
					</div>

					<div class="flex shrink-0 items-center gap-2">
						<button
							onclick={() => openEdit(post)}
							class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
						>
							<Pencil class="h-3.5 w-3.5" /> Edit
						</button>
						<button
							onclick={() => toggleApprove(post)}
							disabled={approvingId === post.id}
							class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 {post.status ===
							'approved'
								? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
								: 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}"
						>
							<Check class="h-3.5 w-3.5" />
							{post.status === 'approved' ? 'Approved' : 'Approve'}
						</button>
						<button
							onclick={() => openSchedule(post)}
							disabled={post.status !== 'approved'}
							class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors {post.status ===
							'approved'
								? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400'
								: 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 opacity-50 dark:border-slate-700 dark:bg-slate-800'}"
						>
							<CalendarPlus class="h-3.5 w-3.5" /> Schedule
						</button>
						{#if post.status === 'approved'}
							<button
								onclick={() => openPublish(post)}
								class="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
							>
								<Send class="h-3.5 w-3.5" /> Publish to Meta
							</button>
						{/if}
						<button
							onclick={() => requestDelete(post)}
							class="rounded-lg border border-transparent p-1.5 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-800 dark:hover:bg-red-900/20"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<ConfirmDialog
	bind:open={showDeleteConfirm}
	title="Delete draft?"
	description={postToDelete ? `"${postToDelete.title}" will be permanently removed.` : ''}
	isLoading={isDeletingPost}
	onconfirm={confirmDelete}
/>

<CreateDraftDrawer
	bind:open={showCreate}
	tenant={data.tenant}
	onCreated={(draft) => { drafts = [draft, ...drafts] }}
/>

<EditDraftDrawer
	bind:open={showEdit}
	draft={selectedForEdit}
	tenant={data.tenant}
	onSaved={(updated) => { drafts = drafts.map((d) => d.id === updated.id ? updated : d) }}
	onDeleted={(id) => { drafts = drafts.filter((d) => d.id !== id); if (selectedForEdit?.id === id) showEdit = false }}
/>

<ScheduleDrawer
	bind:open={showSchedule}
	draft={selectedForSchedule}
	tenant={data.tenant}
	onScheduled={(id) => { drafts = drafts.filter((d) => d.id !== id) }}
/>

<PublishDrawer
	bind:open={showPublish}
	draft={selectedForPublish}
	tenant={data.tenant}
	{metaAccounts}
	onPublished={(id) => { drafts = drafts.filter((d) => d.id !== id) }}
/>

<!-- Platform badge snippet used in the list -->
{#snippet PlatformBadge(props: { platform: PostPlatform })}
	{@const plt = props.platform}
	{@const cfg = PLATFORM[plt]}
	<span
		class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400"
	>
		<div class="h-3.5 w-3.5">
			<ProviderIcon provider={plt} />
		</div>
		{cfg?.label ?? plt}
	</span>
{/snippet}
