<script lang="ts">
	import type { PageData } from './$types';
	import { FileEdit, CheckCircle, Image as ImageIcon, Send, Trash2, MoreVertical, FileJson, X, Plus } from 'lucide-svelte';

	let { data } = $props<{ data: PageData }>();

	let isMenuOpen = $state(false);
	let isModalOpen = $state(false);
	let isFormModalOpen = $state(false);
	let jsonInput = $state('');
	let importError = $state('');
	let isImporting = $state(false);

	let newTitle = $state('');
	let newContent = $state('');
	let newHashtags = $state('');
	let isCreating = $state(false);

	async function createPostViaForm() {
		if (!newTitle.trim() || !newContent.trim()) {
			alert('Title and content are required.');
			return;
		}

		isCreating = true;
		
		const dateStr = new Date().toISOString().split('T')[0];
		const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
		const id = `${dateStr}_${slug || 'post'}`;

		const tags = newHashtags.split(' ').map(t => t.trim()).filter(t => t);

		const payload = {
			workflow: {},
			result: {
				id,
				status: 'draft',
				title: newTitle,
				content: newContent,
				hashtags: tags,
				media_type: 'image'
			}
		};

		const res = await fetch(`/api/posts/${data.client.id}/import`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		isCreating = false;

		if (res.ok) {
			isFormModalOpen = false;
			window.location.reload();
		} else {
			alert('Failed to create post');
		}
	}

	async function importJson() {
		importError = '';
		if (!jsonInput.trim()) {
			importError = 'JSON cannot be empty';
			return;
		}

		let parsed;
		try {
			parsed = JSON.parse(jsonInput);
		} catch (e) {
			importError = 'Invalid JSON format';
			return;
		}

		if (!parsed.result || !parsed.result.id) {
			importError = 'Missing result object or result.id';
			return;
		}

		isImporting = true;
		const res = await fetch(`/api/posts/${data.client.id}/import`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(parsed)
		});

		isImporting = false;

		if (res.ok) {
			isModalOpen = false;
			jsonInput = '';
			window.location.reload();
		} else {
			const err = await res.json();
			importError = err.error || 'Failed to import JSON';
		}
	}

	async function updateStatus(postId: string, filename: string, newStatus: string) {
		await fetch(`/api/posts/${data.client.id}/${filename}/status`, {
			method: 'POST',
			body: JSON.stringify({ status: newStatus })
		});
		window.location.reload();
	}
	
	async function handleQuickUpload(event: Event, postId: string, filename: string) {
		const target = event.target as HTMLInputElement;
		const files = target.files;
		if (!files || files.length === 0) return;

		const formData = new FormData();
		for (let i = 0; i < files.length; i++) {
			formData.append('file', files[i]);
		}

		const res = await fetch(`/api/posts/${data.client.id}/${filename}/media`, {
			method: 'POST',
			body: formData
		});

		if (res.ok) {
			window.location.reload();
		} else {
			alert('Failed to upload media');
		}
	}

	async function deletePost(postId: string, filename: string) {
		if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
			const res = await fetch(`/api/posts/${data.client.id}/${filename}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				window.location.reload();
			} else {
				alert('Failed to delete post');
			}
		}
	}
</script>

<div class="h-14 flex items-center px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-10 sticky top-0">
	<div class="flex items-center gap-2">
		<h2 class="font-semibold text-lg">Social Media</h2>
	</div>

	<div class="ml-auto relative flex items-center gap-2">
		<button 
			onclick={() => { isFormModalOpen = true; }} 
			class="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md font-medium text-sm transition-colors shadow-sm"
		>
			<Plus class="w-4 h-4" /> New
		</button>

		<div class="relative">
			<button 
				onclick={() => isMenuOpen = !isMenuOpen} 
				class="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
			>
				<MoreVertical class="w-5 h-5" />
			</button>
			
			{#if isMenuOpen}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="fixed inset-0 z-40" onclick={() => isMenuOpen = false}></div>
				<div class="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 rounded-md shadow-lg border border-slate-200 dark:border-slate-800 z-50 py-1">
					<button 
						onclick={() => { isModalOpen = true; isMenuOpen = false; }} 
						class="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
					>
						<FileJson class="w-4 h-4" /> Add via JSON
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

<div class="flex-1 overflow-x-auto p-6 h-[calc(100vh-3.5rem)]">
	<div class="flex gap-6 h-full w-max min-w-full">
		
		<!-- Drafts Column -->
		<div class="w-80 flex flex-col h-full bg-slate-100/50 dark:bg-slate-900/50 rounded-xl">
			<div class="p-4 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center gap-2">
				<FileEdit class="w-4 h-4 text-amber-600" />
				<h3 class="font-bold text-slate-700 dark:text-slate-300">Drafts</h3>
				<span class="ml-auto bg-slate-200 dark:bg-slate-800 text-xs py-0.5 px-2 rounded-full font-medium">{data.posts.filter((p) => p.status === 'draft').length}</span>
			</div>
			
			<div class="flex-1 overflow-y-auto p-4 space-y-4">
				{#each data.posts.filter((p) => p.status === 'draft') as post}
					<div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
						<div class="flex items-start justify-between mb-2">
							<span class="text-xs font-mono text-slate-400">{post.id.split('_')[0]}</span>
							<span class="text-[10px] uppercase tracking-wider font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{post.media_type}</span>
						</div>
						{#if post.media_files?.length > 0}
							<div class="mb-3 rounded overflow-hidden aspect-video bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 relative">
								{#if post.media_files[0].match(/\.(mp4|webm)$/i)}
									<video src="/api/media/{data.client.id}/{post.media_files[0]}" class="w-full h-full object-cover" muted loop playsinline></video>
								{:else}
									<img src="/api/media/{data.client.id}/{post.media_files[0]}" alt="Thumbnail" class="w-full h-full object-cover" />
								{/if}
								{#if post.media_files.length > 1}
									<div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm pointer-events-none">
										1/{post.media_files.length}
									</div>
								{/if}
							</div>
						{/if}
						<a href="/{data.client.id}/social/{post.filename}" class="hover:text-indigo-600 block transition-colors">
							<h4 class="font-semibold text-slate-900 dark:text-slate-100 mb-2 leading-snug">{post.title}</h4>
						</a>
						<p class="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-4">{post.content}</p>

						<div class="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700/50">
							<label class="cursor-pointer text-xs flex items-center gap-1.5 text-slate-500 hover:text-indigo-600">
								<ImageIcon class="w-3.5 h-3.5" /> Attach Media
								<input type="file" multiple class="hidden" accept="image/*,video/*" onchange={(e) => handleQuickUpload(e, post.id, post.filename)} />
							</label>

							<div class="flex items-center gap-1 -mr-1">
								<button
									onclick={() => deletePost(post.id, post.filename)}
									title="Delete Post"
									class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
								>
									<Trash2 class="w-4 h-4" />
								</button>
								<a
									href="/{data.client.id}/social/{post.filename}"
									title="Edit Post"
									class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
								>
									<FileEdit class="w-4 h-4" />
								</a>
								<button 
									onclick={() => updateStatus(post.id, post.filename, 'approved')}
									title="Approve Post"
									class="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors"
								>
									<CheckCircle class="w-4 h-4" />
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Approved Column -->
		<div class="w-80 flex flex-col h-full bg-slate-100/50 dark:bg-slate-900/50 rounded-xl">
			<div class="p-4 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center gap-2">
				<CheckCircle class="w-4 h-4 text-emerald-600" />
				<h3 class="font-bold text-slate-700 dark:text-slate-300">Approved</h3>
				<span class="ml-auto bg-slate-200 dark:bg-slate-800 text-xs py-0.5 px-2 rounded-full font-medium">{data.posts.filter((p) => p.status === 'approved').length}</span>
			</div>
			
			<div class="flex-1 overflow-y-auto p-4 space-y-4">
				{#each data.posts.filter((p) => p.status === 'approved') as post}
					<div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-emerald-200 dark:border-emerald-900/50">
						<div class="flex items-start justify-between mb-2">
							<span class="text-xs font-mono text-slate-400">{post.id.split('_')[0]}</span>
							{#if post.media_files?.length > 0}
								<span class="text-xs flex items-center gap-1 text-emerald-600 font-medium">
									<ImageIcon class="w-3 h-3" /> Ready
								</span>
							{:else}
								<span class="text-xs text-amber-500 font-medium bg-amber-50 px-1.5 py-0.5 rounded">Missing Media</span>
							{/if}
						</div>
						{#if post.media_files?.length > 0}
							<div class="mb-3 rounded overflow-hidden aspect-video bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 relative">
								{#if post.media_files[0].match(/\.(mp4|webm)$/i)}
									<video src="/api/media/{data.client.id}/{post.media_files[0]}" class="w-full h-full object-cover" muted loop playsinline></video>
								{:else}
									<img src="/api/media/{data.client.id}/{post.media_files[0]}" alt="Thumbnail" class="w-full h-full object-cover" />
								{/if}
								{#if post.media_files.length > 1}
									<div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm pointer-events-none">
										1/{post.media_files.length}
									</div>
								{/if}
							</div>
						{/if}
						<a href="/{data.client.id}/social/{post.filename}" class="hover:text-indigo-600 block transition-colors">
							<h4 class="font-semibold text-slate-900 dark:text-slate-100 mb-2 leading-snug">{post.title}</h4>
						</a>

						<div class="flex justify-between items-center pt-4 mt-2 border-t border-slate-100 dark:border-slate-700/50">
							<button
								onclick={() => updateStatus(post.id, post.filename, 'draft')}
								class="text-xs text-slate-400 hover:text-slate-700"
							>
								Back to draft
							</button>

							<div class="flex items-center gap-1 -mr-1">
								<button
									onclick={() => deletePost(post.id, post.filename)}
									title="Delete Post"
									class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
								>
									<Trash2 class="w-4 h-4" />
								</button>
								<a
									href="/{data.client.id}/social/{post.filename}"
									title="Edit Post"
									class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
								>
									<FileEdit class="w-4 h-4" />
								</a>
								<button class="text-xs flex items-center gap-1 bg-slate-900 text-white hover:bg-slate-800 px-3 py-1.5 rounded-md font-medium shadow-sm transition-colors ml-1">
									Publish <Send class="w-3 h-3 ml-0.5" />
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

	</div>
</div>

{#if isFormModalOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
		<div class="absolute inset-0" onclick={() => isFormModalOpen = false}></div>
		<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden relative z-10">
			<div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
				<h3 class="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
					<FileEdit class="w-5 h-5 text-indigo-500" /> Create New Post
				</h3>
				<button onclick={() => isFormModalOpen = false} class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
					<X class="w-5 h-5" />
				</button>
			</div>
			
			<div class="p-6 flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950/50 space-y-4">
				<div>
					<label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
					<input 
						type="text" 
						bind:value={newTitle}
						class="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
						placeholder="Post title..."
					/>
				</div>
				
				<div>
					<label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Post Content</label>
					<textarea 
						bind:value={newContent}
						rows="6"
						class="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
						placeholder="Write the post content here..."
					></textarea>
				</div>

				<div>
					<label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hashtags (space separated)</label>
					<input 
						type="text" 
						bind:value={newHashtags}
						class="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
						placeholder="#hashtag1 #hashtag2"
					/>
				</div>
			</div>
			
			<div class="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-end gap-3">
				<button onclick={() => isFormModalOpen = false} class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
				<button onclick={createPostViaForm} disabled={isCreating} class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
					{#if isCreating}
						Loading...
					{:else}
						<Plus class="w-4 h-4" /> Create Post
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if isModalOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
		<div class="absolute inset-0" onclick={() => isModalOpen = false}></div>
		<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden relative z-10">
			<div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
				<h3 class="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
					<FileJson class="w-5 h-5 text-indigo-500" /> Import Post JSON
				</h3>
				<button onclick={() => isModalOpen = false} class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
					<X class="w-5 h-5" />
				</button>
			</div>
			
			<div class="p-6 flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950/50">
				{#if importError}
					<div class="mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm font-medium border border-red-200 dark:border-red-900/50">
						{importError}
					</div>
				{/if}
				<p class="text-sm text-slate-500 dark:text-slate-400 mb-3">Paste the valid JSON payload below. Make sure it matches the <code>result</code> schema.</p>
				<textarea 
					bind:value={jsonInput} 
					class="w-full h-64 font-mono text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
					placeholder={`{
  "result": {
    "id": "YYYY-MM-DD_slug-name",
    "title": "...",
    "content": "..."
  }
}`}
				></textarea>
			</div>
			
			<div class="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-end gap-3">
				<button onclick={() => isModalOpen = false} class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
				<button onclick={importJson} disabled={isImporting} class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
					{#if isImporting}
						Loading...
					{:else}
						<FileJson class="w-4 h-4" /> Import Post
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
