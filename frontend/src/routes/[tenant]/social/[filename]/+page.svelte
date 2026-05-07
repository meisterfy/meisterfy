<script lang="ts">
	import { untrack } from 'svelte'
	import type { PageData } from './$types'
	import { ArrowLeft, Save, FileEdit, Trash2, Sparkles, X, Send } from 'lucide-svelte'
	import { updatePost, deletePost as apiDeletePost } from '$lib/api/posts'
	import { streamGenerate } from '$lib/api/ai'

	let { data } = $props<{ data: PageData }>()

	let title = $state(untrack(() => data.post.title))
	let content = $state(untrack(() => data.post.content))
	let hashtags = $state(untrack(() => data.post.hashtags.join(' ')))
	let status = $state(untrack(() => data.post.status))
	let mediaType = $state(untrack(() => data.post.media_type))
	$effect(() => {
		title = data.post.title
		content = data.post.content
		hashtags = data.post.hashtags.join(' ')
		status = data.post.status
		mediaType = data.post.media_type
	})

	let saving = $state(false)
	let uploadingMedia = $state(false)

	// AI panel state
	let aiOpen = $state(false)
	let aiPrompt = $state('')
	let aiStreaming = $state(false)
	let aiPreview = $state('')
	let aiError = $state<string | null>(null)

	function buildSystemPrompt(): string {
		const b = data.brand
		if (!b) return 'You are a helpful social media copywriter.'
		const parts = ['You are a social media copywriter.']
		if (b.name) parts.push(`Brand: ${b.name}.`)
		if (b.niche) parts.push(`Niche: ${b.niche}.`)
		if (b.location) parts.push(`Location: ${b.location}.`)
		if (b.primary_persona) parts.push(`Target audience: ${b.primary_persona}.`)
		if (b.tone) parts.push(`Tone/voice: ${b.tone}.`)
		if (b.instructions) parts.push(`Guidelines: ${b.instructions}`)
		const lang =
			b.language === 'pt_BR'
				? 'Brazilian Portuguese'
				: b.language === 'es_ES'
					? 'Spanish'
					: 'English'
		parts.push(`Write in ${lang}.`)
		parts.push('Return only the post copy, no extra commentary.')
		return parts.join(' ')
	}

	async function generateContent() {
		if (!aiPrompt.trim() || aiStreaming) return
		aiError = null
		aiPreview = ''
		aiStreaming = true
		try {
			await streamGenerate(
				{
					tenant_id: data.client_id,
					system: buildSystemPrompt(),
					messages: [{ role: 'user', content: aiPrompt.trim() }],
					task_type: 'social_post',
					max_tokens: 800
				},
				(chunk) => {
					aiPreview += chunk.content
				}
			)
		} catch (err) {
			aiError = err instanceof Error ? err.message : 'Generation failed'
		} finally {
			aiStreaming = false
		}
	}

	function applyPreview() {
		content = aiPreview
		aiOpen = false
		aiPrompt = ''
		aiPreview = ''
	}

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement
		const files = target.files
		if (!files || files.length === 0) return

		uploadingMedia = true
		const formData = new FormData()
		for (let i = 0; i < files.length; i++) {
			formData.append('file', files[i])
		}

		const res = await fetch(`/api/media/${data.client_id}/${data.post.id}`, {
			method: 'POST',
			body: formData
		})

		if (res.ok) {
			window.location.reload()
		} else {
			alert('Failed to upload media')
		}
		uploadingMedia = false
	}

	async function savePost() {
		saving = true
		const tags = hashtags
			.split(' ')
			.map((t: string) => t.trim())
			.filter((t: string) => t)
		try {
			await updatePost(data.client_id, data.post.id, {
				title,
				content,
				hashtags: tags,
				status: status as import('$lib/api/posts').PostStatus,
				media_type: mediaType
			})
			window.location.href = `/${data.client_id}/social`
		} finally {
			saving = false
		}
	}

	async function deletePost() {
		if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
			try {
				await apiDeletePost(data.client_id, data.post.id)
				window.location.href = `/${data.client_id}/social`
			} catch {
				alert('Failed to delete post')
			}
		}
	}
</script>

<!-- Top bar -->
<div
	class="sticky top-0 z-10 flex h-14 items-center border-b border-slate-200 bg-white px-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
>
	<div class="flex items-center gap-4">
		<a
			href="/{data.client_id}/social"
			class="text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<h2 class="flex items-center gap-2 text-lg font-semibold">
			<FileEdit class="h-4 w-4 text-slate-400" />
			Edit Post
		</h2>
	</div>
	<div class="ml-auto flex items-center gap-3">
		<button
			onclick={() => {
				aiOpen = true
			}}
			title="Generate with AI"
			class="flex items-center gap-1.5 rounded-md border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
		>
			<Sparkles class="h-4 w-4" /> Generate
		</button>
		<button
			onclick={deletePost}
			title="Delete Post"
			class="rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
		>
			<Trash2 class="h-4 w-4" />
		</button>
		<button
			onclick={savePost}
			disabled={saving}
			class="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
		>
			<Save class="h-4 w-4" />
			{saving ? 'Saving...' : 'Save Changes'}
		</button>
	</div>
</div>

<!-- AI Panel (slide-in from right) -->
{#if aiOpen}
	<!-- backdrop -->
	<div
		class="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm"
		onclick={() => {
			if (!aiStreaming) {
				aiOpen = false
			}
		}}
		role="presentation"
	></div>

	<div
		class="fixed top-0 right-0 z-30 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
	>
		<div
			class="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"
		>
			<div class="flex items-center gap-2">
				<Sparkles class="h-5 w-5 text-indigo-500" />
				<span class="font-semibold text-slate-900 dark:text-white">Generate with AI</span>
			</div>
			<button
				onclick={() => {
					aiOpen = false
				}}
				disabled={aiStreaming}
				class="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-40 dark:hover:text-slate-200"
			>
				<X class="h-5 w-5" />
			</button>
		</div>

		<!-- Brand context badge -->
		{#if data.brand}
			<div
				class="mx-5 mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300"
			>
				Using brand context: <span class="font-semibold">{data.brand.name}</span>
				{#if data.brand.tone}
					· {data.brand.tone}{/if}
			</div>
		{/if}

		<div class="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
			<!-- Prompt input -->
			<div>
				<label
					for="ai-prompt"
					class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
				>
					Instruction
				</label>
				<textarea
					id="ai-prompt"
					bind:value={aiPrompt}
					rows={4}
					placeholder="e.g. Write a post announcing our summer sale with 20% off all items"
					class="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
					disabled={aiStreaming}
				></textarea>
			</div>

			<button
				onclick={generateContent}
				disabled={!aiPrompt.trim() || aiStreaming}
				class="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
			>
				<Send class="h-4 w-4" />
				{aiStreaming ? 'Generating…' : 'Generate'}
			</button>

			{#if aiError}
				<p
					class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
				>
					{aiError}
				</p>
			{/if}

			<!-- Preview -->
			{#if aiPreview}
				<div>
					<p class="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">Preview</p>
					<div
						class="min-h-[6rem] rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm whitespace-pre-wrap text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
					>
						{aiPreview}{#if aiStreaming}<span class="animate-pulse">▌</span>{/if}
					</div>
					{#if !aiStreaming}
						<button
							onclick={applyPreview}
							class="mt-2 w-full rounded-lg border border-indigo-300 bg-indigo-50 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
						>
							Apply to post
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Main layout -->
<div class="mx-auto grid max-w-5xl grid-cols-1 gap-8 p-6 lg:grid-cols-3">
	<!-- Editor -->
	<div class="space-y-6 lg:col-span-2">
		<div>
			<label
				for="post-title"
				class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
				>Title (Internal)</label
			>
			<input
				id="post-title"
				type="text"
				bind:value={title}
				class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
			/>
		</div>

		<div>
			<label
				for="post-content"
				class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
				>Post Content</label
			>
			<textarea
				id="post-content"
				bind:value={content}
				rows={16}
				class="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
			></textarea>
		</div>

		<div>
			<label
				for="post-hashtags"
				class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
				>Hashtags (space separated)</label
			>
			<input
				id="post-hashtags"
				type="text"
				bind:value={hashtags}
				class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
			/>
		</div>
	</div>

	<!-- Sidebar -->
	<div class="space-y-6">
		<div
			class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
		>
			<h3 class="mb-3 text-sm font-bold text-slate-900 dark:text-white">Media</h3>

			{#if data.post.media_files?.length > 0}
				<div
					class="mb-4 grid gap-2 {data.post.media_files.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}"
				>
					{#each data.post.media_files as mediaFile}
						<div
							class="group relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
						>
							{#if mediaFile.match(/\.(mp4|webm)$/i)}
								<video
									src="/api/media/{data.client_id}/{mediaFile}"
									controls
									class="h-full w-full object-cover"
								>
									<track kind="captions" />
								</video>
							{:else}
								<img
									src="/api/media/{data.client_id}/{mediaFile}"
									alt="Post Media"
									class="h-full w-full object-cover"
								/>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div
					class="mb-4 flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 dark:border-slate-600 dark:bg-slate-800/50"
				>
					<span class="text-xs font-medium">No media attached</span>
				</div>
			{/if}

			<label class="block cursor-pointer">
				<span class="sr-only">Choose media</span>
				<input
					type="file"
					multiple
					class="block w-full cursor-pointer text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
					accept="image/*,video/*"
					onchange={handleFileUpload}
					disabled={uploadingMedia}
				/>
			</label>
			{#if uploadingMedia}
				<p class="mt-2 animate-pulse text-xs font-medium text-indigo-600">Uploading...</p>
			{/if}
		</div>

		<div
			class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
		>
			<h3 class="mb-3 text-sm font-bold text-slate-900 dark:text-white">AI Workflow</h3>

			{#if data.post.workflow}
				<div class="space-y-4">
					<div>
						<span class="text-xs font-semibold tracking-wider text-slate-500 uppercase"
							>Strategy</span
						>
						<p class="mt-1 text-sm text-slate-700 dark:text-slate-300">
							<span class="font-medium">{data.post.workflow.strategy?.framework}:</span>
							{data.post.workflow.strategy?.reasoning}
						</p>
					</div>
					<div>
						<span class="text-xs font-semibold tracking-wider text-slate-500 uppercase"
							>Clarity</span
						>
						<p class="mt-1 text-sm text-slate-700 dark:text-slate-300">
							{data.post.workflow.clarity?.changes}
						</p>
					</div>
					<div>
						<span class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Impact</span
						>
						<p class="mt-1 text-sm text-slate-700 dark:text-slate-300">
							{data.post.workflow.impact?.changes}
						</p>
					</div>
				</div>
			{:else}
				<p class="text-sm text-slate-500">No workflow data available.</p>
			{/if}
		</div>

		<div
			class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
		>
			<h3 class="mb-3 text-sm font-bold text-slate-900 dark:text-white">Post Info</h3>
			<div class="space-y-3 text-sm text-slate-600 dark:text-slate-400">
				<div class="flex items-center justify-between">
					<span>ID</span>
					<span class="font-mono text-xs">{data.post.id}</span>
				</div>
				<div class="flex items-center justify-between">
					<span>Status</span>
					<select
						bind:value={status}
						class="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 {status ===
						'approved'
							? 'text-emerald-600'
							: 'text-amber-600'}"
					>
						<option value="draft" class="font-medium text-amber-600">draft</option>
						<option value="approved" class="font-medium text-emerald-600">approved</option>
					</select>
				</div>
				<div class="flex items-center justify-between">
					<span>Media</span>
					<select
						bind:value={mediaType}
						class="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold tracking-wider text-indigo-600 uppercase focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
					>
						<option value="image">image</option>
						<option value="video">video</option>
						<option value="carousel">carousel</option>
						<option value="story">story</option>
					</select>
				</div>
			</div>
		</div>
	</div>
</div>
