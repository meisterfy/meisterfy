<script lang="ts">
	import { ChevronLeft, ChevronRight, Plus, X, Clock, Trash2 } from 'lucide-svelte';
	import { Dialog } from 'bits-ui';
	import type { PageData } from './$types';
	import type { PostWithMeta, PostPlatform } from '$lib/server/db';
	import { PLATFORM_CONFIG as PLATFORM, PLATFORM_OPTIONS as PLATFORMS, normPlatforms } from '$lib/social';
	import ConfirmDialog from '$lib/components/ui/dialog/ConfirmDialog.svelte';
	import MultiSelect from '$lib/components/ui/multiselect/MultiSelect.svelte';

	let { data } = $props<{ data: PageData }>();

	// ── Calendar state ────────────────────────────────────────────────────────
	const today = new Date();
	let viewYear = $state(today.getFullYear());
	let viewMonth = $state(today.getMonth());

	const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
	const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

	let scheduled = $state<PostWithMeta[]>(data.scheduled);
	$effect(() => { scheduled = data.scheduled; });

	const calendarCells = $derived.by(() => {
		const firstDay = new Date(viewYear, viewMonth, 1).getDay();
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const byDate = new Map<string, PostWithMeta[]>();
		for (const p of scheduled) {
			if (!p.scheduled_date) continue;
			if (!byDate.has(p.scheduled_date)) byDate.set(p.scheduled_date, []);
			byDate.get(p.scheduled_date)!.push(p);
		}
		const cells: Array<{ date: string | null; day: number | null; posts: PostWithMeta[] }> = [];
		for (let i = 0; i < firstDay; i++) cells.push({ date: null, day: null, posts: [] });
		for (let d = 1; d <= daysInMonth; d++) {
			const mm = String(viewMonth + 1).padStart(2, '0');
			const dd = String(d).padStart(2, '0');
			const date = `${viewYear}-${mm}-${dd}`;
			cells.push({ date, day: d, posts: byDate.get(date) ?? [] });
		}
		while (cells.length % 7 !== 0) cells.push({ date: null, day: null, posts: [] });
		return cells;
	});

	function prevMonth() { if (viewMonth === 0) { viewMonth = 11; viewYear--; } else viewMonth--; }
	function nextMonth() { if (viewMonth === 11) { viewMonth = 0; viewYear++; } else viewMonth++; }
	function isToday(date: string | null) { return date === today.toISOString().slice(0, 10); }

	// ── Post edit modal ───────────────────────────────────────────────────────
	let selectedPost = $state<PostWithMeta | null>(null);
	let editTitle = $state('');
	let editContent = $state('');
	let editHashtags = $state('');
	let editPlatforms = $state<PostPlatform[]>([]);
	let editDate = $state('');
	let editTime = $state('');
	let editMediaFiles = $state<string[]>([]);
	let isSavingPost = $state(false);
	let isUploadingMedia = $state(false);

	function openPostModal(post: PostWithMeta) {
		selectedPost = post;
		editTitle = post.title;
		editContent = post.content;
		editHashtags = post.hashtags?.join(' ') ?? '';
		editPlatforms = normPlatforms(post.platform);
		editDate = post.scheduled_date ?? '';
		editTime = post.scheduled_time ?? '';
		editMediaFiles = [...(post.media_files ?? [])];
	}

	async function savePost() {
		if (!selectedPost || !editTitle.trim() || !editContent.trim()) return;
		isSavingPost = true;
		try {
			const tags = editHashtags.split(/\s+/).map((t) => t.trim()).filter(Boolean);
			const res = await fetch(`/api/posts/${data.tenant}/${selectedPost.filename}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: editTitle, content: editContent, hashtags: tags,
					platform: editPlatforms,
					scheduled_date: editDate || undefined,
					scheduled_time: editTime || undefined,
				}),
			});
			if (res.ok) {
				selectedPost.title = editTitle;
				selectedPost.content = editContent;
				selectedPost.hashtags = tags;
				selectedPost.platform = editPlatforms[0];
				selectedPost.scheduled_date = editDate || undefined;
				selectedPost.scheduled_time = editTime || undefined;
				scheduled = [...scheduled];
				selectedPost = null;
			}
		} finally { isSavingPost = false; }
	}

	async function handleMediaUpload(event: Event) {
		if (!selectedPost) return;
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;
		isUploadingMedia = true;
		const fd = new FormData();
		for (let i = 0; i < files.length; i++) fd.append('file', files[i]);
		const res = await fetch(`/api/posts/${data.tenant}/${selectedPost.filename}/media`, { method: 'POST', body: fd });
		if (res.ok) {
			const body = await res.json() as { media_files: string[] };
			editMediaFiles = body.media_files ?? [];
			selectedPost.media_files = editMediaFiles;
		}
		input.value = '';
		isUploadingMedia = false;
	}

	async function removeMedia() {
		if (!selectedPost) return;
		await fetch(`/api/posts/${data.tenant}/${selectedPost.filename}/media`, { method: 'DELETE' });
		editMediaFiles = [];
		selectedPost.media_files = [];
	}

	// ── Delete confirm ────────────────────────────────────────────────────────
	let showDeleteConfirm = $state(false);
	let isDeletingPost = $state(false);

	function requestDelete() {
		showDeleteConfirm = true;
	}

	async function confirmDelete() {
		if (!selectedPost) return;
		isDeletingPost = true;
		try {
			const res = await fetch(`/api/posts/${data.tenant}/${selectedPost.filename}`, { method: 'DELETE' });
			if (res.ok) {
				scheduled = scheduled.filter((p) => p.id !== selectedPost!.id);
				selectedPost = null;
				showDeleteConfirm = false;
			}
		} finally { isDeletingPost = false; }
	}

	// ── New post modal (calendar "+") ─────────────────────────────────────────
	let newPostDate = $state<string | null>(null);
	let newTitle = $state('');
	let newContent = $state('');
	let newHashtags = $state('');
	let newTime = $state('10:00');
	let newPlatforms = $state<PostPlatform[]>(['instagram_feed']);
	let newMediaInput = $state<HTMLInputElement | null>(null);
	let isCreating = $state(false);

	function openNewPost(date: string) {
		newPostDate = date;
		newTitle = ''; newContent = ''; newHashtags = '';
		newTime = '10:00'; newPlatforms = ['instagram_feed'];
	}

	async function createPost() {
		if (!newPostDate || !newTitle.trim() || !newContent.trim()) return;
		isCreating = true;
		try {
			const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
			const id = `${newPostDate}_${slug || 'post'}`;
			const tags = newHashtags.split(/\s+/).map((t) => t.trim()).filter(Boolean);
			const res = await fetch(`/api/posts/${data.tenant}/import`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					workflow: {},
					result: { id, status: 'scheduled', title: newTitle, content: newContent,
						hashtags: tags, media_type: 'image',
						scheduled_date: newPostDate, scheduled_time: newTime || undefined,
						platform: newPlatforms },
				}),
			});
			if (res.ok) {
				const body = await res.json() as { success: boolean; filename: string };
				const files = newMediaInput?.files;
				let mediaFiles: string[] = [];
				if (files && files.length > 0 && body.filename) {
					const fd = new FormData();
					for (let i = 0; i < files.length; i++) fd.append('file', files[i]);
					const mr = await fetch(`/api/posts/${data.tenant}/${body.filename}/media`, { method: 'POST', body: fd });
					if (mr.ok) {
						const mb = await mr.json() as { media_files: string[] };
						mediaFiles = mb.media_files ?? [];
					}
				}
				scheduled = [...scheduled, {
					id, status: 'scheduled', title: newTitle, content: newContent,
					hashtags: tags, media_type: 'image',
					scheduled_date: newPostDate, scheduled_time: newTime || undefined,
					platform: newPlatforms[0],
					client_id: data.tenant, filename: `${id}.json`, media_files: mediaFiles, workflow: {},
				}];
				newPostDate = null;
			}
		} finally { isCreating = false; }
	}

	const inputCls = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500';
	const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';
</script>

<div class="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

	<!-- Calendar header -->
	<div class="mb-6 flex items-center justify-between">
		<h2 class="text-xl font-bold text-slate-900 dark:text-white">{MONTHS[viewMonth]} {viewYear}</h2>
		<div class="flex items-center gap-1">
			<button onclick={prevMonth} class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft class="h-5 w-5" /></button>
			<button onclick={() => { viewYear = today.getFullYear(); viewMonth = today.getMonth(); }} class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">Today</button>
			<button onclick={nextMonth} class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight class="h-5 w-5" /></button>
		</div>
	</div>

	<!-- Day headers -->
	<div class="mb-1 grid grid-cols-7">
		{#each DAYS as d}
			<div class="py-2 text-center text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{d}</div>
		{/each}
	</div>

	<!-- Calendar grid -->
	<div class="grid grid-cols-7 border-l border-t border-slate-200 dark:border-slate-800">
		{#each calendarCells as cell}
			<div class="group/cell relative min-h-[110px] border-b border-r border-slate-200 p-1.5 dark:border-slate-800 {cell.date ? 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/40' : 'bg-slate-50 dark:bg-slate-950'}">
				{#if cell.day}
					<div class="mb-1 flex items-center justify-between px-0.5">
						<span class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold {isToday(cell.date) ? 'bg-indigo-500 text-white' : 'text-slate-500 dark:text-slate-400'}">{cell.day}</span>
						<button
							onclick={() => openNewPost(cell.date!)}
							class="flex h-5 w-5 items-center justify-center rounded text-slate-400 opacity-0 transition-opacity hover:bg-indigo-50 hover:text-indigo-600 group-hover/cell:opacity-100 dark:hover:bg-indigo-900/30"
						>
							<Plus class="h-3.5 w-3.5" />
						</button>
					</div>
					<div class="flex flex-col gap-0.5">
						{#each cell.posts.slice(0, 3) as post (post.id)}
							<button
								onclick={() => openPostModal(post)}
								class="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left opacity-100 transition-opacity hover:opacity-80"
								style="background: {post.status === 'published' ? 'rgb(220 252 231)' : 'rgb(254 243 199)'}"
							>
								{#each normPlatforms(post.platform).slice(0, 2) as plt}
									{#if PLATFORM[plt]}
										<span class="h-1.5 w-1.5 shrink-0 rounded-full {PLATFORM[plt].color}"></span>
									{/if}
								{/each}
								<span class="truncate text-[10px] font-medium text-slate-700">{post.title}</span>
							</button>
						{/each}
						{#if cell.posts.length > 3}
							<span class="pl-1 text-[10px] text-slate-400">+{cell.posts.length - 3} more</span>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Legend -->
	<div class="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
		<span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-sm border border-amber-300 bg-amber-100"></span> Scheduled</span>
		<span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-sm border border-emerald-300 bg-emerald-100"></span> Published</span>
		{#each Object.entries(PLATFORM) as [, val]}
			<span class="flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full {val.color}"></span> {val.label}</span>
		{/each}
	</div>
</div>

<!-- ── Delete confirm ────────────────────────────────────────────────────────── -->
<ConfirmDialog
	bind:open={showDeleteConfirm}
	title="Delete post?"
	description={selectedPost ? `"${selectedPost.title}" will be permanently removed.` : ''}
	isLoading={isDeletingPost}
	onconfirm={confirmDelete}
/>

<!-- ── New post modal ────────────────────────────────────────────────────────── -->
<Dialog.Root
	open={newPostDate !== null}
	onOpenChange={(v) => { if (!v) newPostDate = null; }}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
		>
			{#if newPostDate}
				<div class="mb-5 flex items-center justify-between">
					<div>
						<Dialog.Title class="text-lg font-bold text-slate-900 dark:text-white">New Post</Dialog.Title>
						<p class="font-mono text-xs text-slate-400">{newPostDate}</p>
					</div>
					<button onclick={() => (newPostDate = null)} class="text-slate-400 transition-colors hover:text-slate-600">
						<X class="h-4 w-4" />
					</button>
				</div>
				<div class="flex flex-col gap-4">
					<div>
						<label class={labelCls}>Platform</label>
						<MultiSelect bind:value={newPlatforms} options={PLATFORMS} placeholder="Select platforms…" />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class={labelCls}>Date <span class="font-normal normal-case text-slate-400">(fixed)</span></label>
							<input type="date" value={newPostDate} disabled class="{inputCls} cursor-not-allowed opacity-60" />
						</div>
						<div>
							<label class={labelCls}>Time <span class="font-normal normal-case text-slate-400">(opt.)</span></label>
							<input type="time" bind:value={newTime} class={inputCls} />
						</div>
					</div>
					<div>
						<label class={labelCls}>Title</label>
						<input bind:value={newTitle} type="text" placeholder="Post title" class={inputCls} />
					</div>
					<div>
						<label class={labelCls}>Content</label>
						<textarea bind:value={newContent} rows="5" placeholder="Post copy…" class="{inputCls} resize-none"></textarea>
					</div>
					<div>
						<label class={labelCls}>Hashtags <span class="font-normal normal-case text-slate-400">(space separated)</span></label>
						<input bind:value={newHashtags} type="text" placeholder="#hashtag1 #hashtag2" class={inputCls} />
					</div>
					<div>
						<label class={labelCls}>Image <span class="font-normal normal-case text-slate-400">(optional)</span></label>
						<input bind:this={newMediaInput} type="file" accept="image/*,video/*" multiple class="w-full cursor-pointer text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400" />
					</div>
				</div>
				<div class="mt-6 flex gap-3">
					<button
						onclick={createPost}
						disabled={!newTitle.trim() || !newContent.trim() || isCreating}
						class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
					>
						<Clock class="h-4 w-4" /> {isCreating ? 'Saving…' : 'Add to Planner'}
					</button>
					<button
						onclick={() => (newPostDate = null)}
						class="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
					>
						Cancel
					</button>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<!-- ── Post edit/view modal ──────────────────────────────────────────────────── -->
<Dialog.Root
	open={selectedPost !== null}
	onOpenChange={(v) => { if (!v) selectedPost = null; }}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
		>
			{#if selectedPost}
				<!-- Header -->
				<div class="mb-5 flex items-start justify-between pr-2">
					<div>
						<div class="mb-1 flex flex-wrap items-center gap-2">
							<span class="rounded-full px-2 py-0.5 text-xs font-bold uppercase {selectedPost.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">{selectedPost.status}</span>
							{#each normPlatforms(selectedPost.platform) as plt}
								{#if PLATFORM[plt]}
									<span class="flex items-center gap-1 text-xs text-slate-500">
										<span class="h-2 w-2 rounded-full {PLATFORM[plt].color}"></span>{PLATFORM[plt].label}
									</span>
								{/if}
							{/each}
						</div>
						<p class="font-mono text-xs text-slate-400">{selectedPost.id}</p>
					</div>
					<div class="flex shrink-0 items-center gap-2">
						{#if selectedPost.status !== 'published'}
							<button
								onclick={requestDelete}
								class="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
							>
								<Trash2 class="h-3.5 w-3.5" /> Delete
							</button>
						{/if}
						<button onclick={() => (selectedPost = null)} class="text-slate-400 transition-colors hover:text-slate-600">
							<X class="h-4 w-4" />
						</button>
					</div>
				</div>

				{#if selectedPost.status === 'published'}
					<!-- Read-only view -->
					<p class="mb-2 font-bold text-slate-900 dark:text-white">{selectedPost.title}</p>
					{#if selectedPost.scheduled_date}
						<p class="mb-3 text-xs text-slate-400">{selectedPost.scheduled_date}{selectedPost.scheduled_time ? ' · ' + selectedPost.scheduled_time : ''}</p>
					{/if}
					{#if editMediaFiles.length > 0}
						<div class="mb-4 grid gap-2 {editMediaFiles.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}">
							{#each editMediaFiles as f}
								<div class="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700">
									{#if f.match(/\.(mp4|webm)$/i)}
										<video src="/api/media/{data.tenant}/{f}" controls class="max-h-full max-w-full object-contain"></video>
									{:else}
										<img src="/api/media/{data.tenant}/{f}" alt="Media" class="max-h-full max-w-full object-contain" />
									{/if}
								</div>
							{/each}
						</div>
					{/if}
					<p class="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{selectedPost.content}</p>
					{#if selectedPost.hashtags?.length}
						<p class="flex flex-wrap gap-1 text-xs text-indigo-500 dark:text-indigo-400">
							{#each selectedPost.hashtags as tag}<span>{tag}</span>{/each}
						</p>
					{/if}

				{:else}
					<!-- Editable form -->
					<div class="flex flex-col gap-4">
						<div>
							<label class={labelCls}>Platform</label>
							<MultiSelect bind:value={editPlatforms} options={PLATFORMS} placeholder="Select platforms…" />
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class={labelCls}>Date</label>
								<input type="date" bind:value={editDate} class={inputCls} />
							</div>
							<div>
								<label class={labelCls}>Time <span class="font-normal normal-case text-slate-400">(opt.)</span></label>
								<input type="time" bind:value={editTime} class={inputCls} />
							</div>
						</div>
						<div>
							<label class={labelCls}>Title</label>
							<input bind:value={editTitle} type="text" class={inputCls} />
						</div>
						<div>
							<label class={labelCls}>Content</label>
							<textarea bind:value={editContent} rows="7" class="{inputCls} resize-y"></textarea>
						</div>
						<div>
							<label class={labelCls}>Hashtags <span class="font-normal normal-case text-slate-400">(space separated)</span></label>
							<input bind:value={editHashtags} type="text" class={inputCls} />
							{#if editHashtags}
								<p class="mt-1.5 flex flex-wrap gap-1 text-xs text-indigo-500 dark:text-indigo-400">
									{#each editHashtags.split(/\s+/).filter(Boolean) as tag}<span>{tag}</span>{/each}
								</p>
							{/if}
						</div>

						<!-- Media -->
						<div>
							<div class="mb-1.5 flex items-center justify-between">
								<label class={labelCls}>Image</label>
								{#if editMediaFiles.length > 0}
									<button onclick={removeMedia} class="flex items-center gap-1 text-xs text-red-500 transition-colors hover:text-red-700">
										<Trash2 class="h-3 w-3" /> Remove all
									</button>
								{/if}
							</div>
							{#if editMediaFiles.length > 0}
								<div class="mb-3 grid gap-2 {editMediaFiles.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}">
									{#each editMediaFiles as f}
										<div class="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700">
											{#if f.match(/\.(mp4|webm)$/i)}
												<video src="/api/media/{data.tenant}/{f}" controls class="max-h-full max-w-full object-contain"></video>
											{:else}
												<img src="/api/media/{data.tenant}/{f}" alt="Media" class="max-h-full max-w-full object-contain" />
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<div class="mb-3 flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 text-xs font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800/50">
									No image attached
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
								<p class="mt-1 animate-pulse text-xs text-indigo-600 dark:text-indigo-400">Uploading…</p>
							{/if}
						</div>
					</div>

					<div class="mt-6 flex gap-3">
						<button
							onclick={savePost}
							disabled={!editTitle.trim() || !editContent.trim() || isSavingPost}
							class="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
						>
							{isSavingPost ? 'Saving…' : 'Save Changes'}
						</button>
						<button
							onclick={() => (selectedPost = null)}
							class="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
						>
							Cancel
						</button>
					</div>
				{/if}
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
