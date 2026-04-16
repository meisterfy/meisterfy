<script lang="ts">
	import type { PageData } from './$types';
	import { FileEdit, FileJson, X, Plus, LayoutGrid, LayoutList, Columns, MoreVertical } from 'lucide-svelte';
	import KanbanView from '$lib/components/social/KanbanView.svelte';
	import CardsView from '$lib/components/social/CardsView.svelte';
	import ListView from '$lib/components/social/ListView.svelte';
	import { browser } from '$app/environment';

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

	// Layout State
	let layoutMode = $state('kanban'); // 'kanban' | 'cards' | 'lista'

	// Load layout from localStorage on client side
	$effect(() => {
		if (browser) {
			const saved = localStorage.getItem('socialLayoutMode');
			if (saved && ['kanban', 'cards', 'lista'].includes(saved)) {
				layoutMode = saved;
			}
		}
	});

	// Save layout to localStorage whenever it changes
	$effect(() => {
		if (browser) {
			localStorage.setItem('socialLayoutMode', layoutMode);
		}
	});

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

	<div class="ml-auto flex items-center gap-4">
		<!-- Layout Selector -->
		<div class="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5">
			{#each [
				{ mode: 'kanban', icon: Columns,    label: 'Kanban' },
				{ mode: 'cards',  icon: LayoutGrid, label: 'Cards'  },
				{ mode: 'lista',  icon: LayoutList, label: 'Lista'  },
			] as opt (opt.mode)}
				{@const active = layoutMode === opt.mode}
				<button
					onclick={() => layoutMode = opt.mode}
					title={opt.label}
					class="flex items-center px-2 py-1.5 rounded-md transition-all {active
						? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
						: 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}"
				>
					<svelte:component this={opt.icon} class="w-4 h-4" />
				</button>
			{/each}
		</div>

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
	{#if layoutMode === 'kanban'}
		<KanbanView posts={data.posts} clientId={data.client.id} onUpdateStatus={updateStatus} onDelete={deletePost} onUpload={handleQuickUpload} />
	{:else if layoutMode === 'cards'}
		<CardsView posts={data.posts} clientId={data.client.id} onUpdateStatus={updateStatus} onDelete={deletePost} onUpload={handleQuickUpload} />
	{:else if layoutMode === 'lista'}
		<ListView posts={data.posts} clientId={data.client.id} onUpdateStatus={updateStatus} onDelete={deletePost} onUpload={handleQuickUpload} />
	{/if}
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
