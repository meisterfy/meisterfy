<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import {
		FileEdit,
		CheckCircle,
		Image as ImageIcon,
		Send,
		Trash2,
		Clock,
		AlertTriangle,
		AlertCircle
	} from 'lucide-svelte'
	import { resolve } from '$app/paths'

	import type { Post, PostStatus } from '$lib/api/posts'

	let {
		post,
		clientId,
		onUpdateStatus,
		onDelete,
		onUpload,
		stretch = true
	} = $props<{
		post: Post & { filename: string; media_files: string[] }
		clientId: string
		onUpdateStatus: (id: string, filename: string, status: PostStatus) => void
		onDelete: (id: string, filename: string) => void
		onUpload: (event: Event, id: string, filename: string) => void
		stretch?: boolean
	}>()

	let isDraft = $derived(post.status === 'draft')
	let isScheduled = $derived(post.status === 'scheduled')
	let isFailed = $derived(post.status === 'failed')
	let isPartial = $derived(post.status === 'partially_published')
</script>

<div
	class="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-800 {isDraft
		? 'border-slate-200 dark:border-slate-700'
		: 'border-emerald-200 dark:border-emerald-900/50'} flex flex-col {stretch ? 'h-full' : ''}"
>
	<div class="mb-2 flex items-start justify-between">
		<span class="font-mono text-xs text-slate-400">{post.id.split('_')[0]}</span>
		{#if isDraft}
			<span
				class="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-indigo-500 uppercase"
				>{post.media_type}</span
			>
		{:else if post.media_files?.length > 0}
			<span class="flex items-center gap-1 text-xs font-medium text-emerald-600">
				<ImageIcon class="h-3 w-3" /> Ready
			</span>
		{:else}
			<span class="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-500"
				>{m['social-media:missing_media']()}</span
			>
		{/if}
	</div>

	{#if post.media_files?.length > 0}
		<div
			class="relative mb-3 aspect-video overflow-hidden rounded border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
		>
			{#if post.media_files[0].match(/\.(mp4|webm)$/i)}
				<video
					src="/api/media/{clientId}/{post.media_files[0]}"
					class="h-full w-full object-cover"
					muted
					loop
					playsinline
				></video>
			{:else}
				<img
					src="/api/media/{clientId}/{post.media_files[0]}"
					alt="Thumbnail"
					class="h-full w-full object-cover"
				/>
			{/if}
			{#if post.media_files.length > 1}
				<div
					class="pointer-events-none absolute top-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm"
				>
					1/{post.media_files.length}
				</div>
			{/if}
		</div>
	{/if}

	{#if isScheduled || isFailed || isPartial}
		<div class="mb-2">
			{#if isScheduled}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
				>
					<Clock class="h-3 w-3" />
					{post.scheduled_date ?? 'Scheduled'}
				</span>
			{:else if isFailed}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400"
				>
					<AlertTriangle class="h-3 w-3" />
					{m['social-media:publish_failed']()}
				</span>
			{:else if isPartial}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
				>
					<AlertCircle class="h-3 w-3" />
					{m['social-media:partially_published']()}
				</span>
			{/if}
		</div>
	{/if}

	<div class="flex-1">
		<a
			href={resolve(`/${clientId}/social/${post.filename}`)}
			class="block transition-colors hover:text-indigo-600"
		>
			<h4 class="mb-2 leading-snug font-semibold text-slate-900 dark:text-slate-100">
				{post.title}
			</h4>
		</a>
		{#if isDraft}
			<p class="mb-4 line-clamp-3 text-sm text-slate-500 dark:text-slate-400">{post.content}</p>
		{/if}
	</div>

	<div
		class="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-700/50"
	>
		{#if isDraft}
			<label
				class="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600"
			>
				<ImageIcon class="h-3.5 w-3.5" />
				{m['social-media:attach_media']()}
				<input
					type="file"
					multiple
					class="hidden"
					accept="image/*,video/*"
					onchange={(e) => onUpload(e, post.id, post.filename)}
				/>
			</label>
		{:else}
			<button
				onclick={() => onUpdateStatus(post.id, post.filename, 'draft')}
				class="text-xs text-slate-400 hover:text-slate-700"
			>
				{m['social-media:back_to_draft']()}
			</button>
		{/if}

		<div class="-mr-1 flex items-center gap-1">
			<button
				onclick={() => onDelete(post.id, post.filename)}
				title={m['social-media:delete_post']()}
				class="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
			>
				<Trash2 class="h-4 w-4" />
			</button>
			<a
				href={resolve(`/${clientId}/social/${post.filename}`)}
				title={m['social-media:edit_post']()}
				class="rounded p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30"
			>
				<FileEdit class="h-4 w-4" />
			</a>
			{#if isDraft}
				<button
					onclick={() => onUpdateStatus(post.id, post.filename, 'approved')}
					title={m['social-media:approve_post']()}
					class="rounded p-1.5 text-emerald-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30"
				>
					<CheckCircle class="h-4 w-4" />
				</button>
			{:else}
				<button
					class="ml-1 flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
				>
					{m['social-media:publish_to_meta']()}
					<Send class="ml-0.5 h-3 w-3" />
				</button>
			{/if}
		</div>
	</div>
</div>
