<script lang="ts">
	import { FileEdit, CheckCircle, Image as ImageIcon, Send, Trash2 } from 'lucide-svelte';

	let { post, clientId, onUpdateStatus, onDelete, onUpload, stretch = true } = $props<{
		post: any;
		clientId: string;
		onUpdateStatus: (id: string, filename: string, status: string) => void;
		onDelete: (id: string, filename: string) => void;
		onUpload: (event: Event, id: string, filename: string) => void;
		stretch?: boolean;
	}>();

	let isDraft = $derived(post.status === 'draft');
</script>

<div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border {isDraft ? 'border-slate-200 dark:border-slate-700' : 'border-emerald-200 dark:border-emerald-900/50'} flex flex-col {stretch ? 'h-full' : ''}">
	<div class="flex items-start justify-between mb-2">
		<span class="text-xs font-mono text-slate-400">{post.id.split('_')[0]}</span>
		{#if isDraft}
			<span class="text-[10px] uppercase tracking-wider font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{post.media_type}</span>
		{:else}
			{#if post.media_files?.length > 0}
				<span class="text-xs flex items-center gap-1 text-emerald-600 font-medium">
					<ImageIcon class="w-3 h-3" /> Ready
				</span>
			{:else}
				<span class="text-xs text-amber-500 font-medium bg-amber-50 px-1.5 py-0.5 rounded">Missing Media</span>
			{/if}
		{/if}
	</div>
	
	{#if post.media_files?.length > 0}
		<div class="mb-3 rounded overflow-hidden aspect-video bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 relative">
			{#if post.media_files[0].match(/\.(mp4|webm)$/i)}
				<video src="/api/media/{clientId}/{post.media_files[0]}" class="w-full h-full object-cover" muted loop playsinline></video>
			{:else}
				<img src="/api/media/{clientId}/{post.media_files[0]}" alt="Thumbnail" class="w-full h-full object-cover" />
			{/if}
			{#if post.media_files.length > 1}
				<div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm pointer-events-none">
					1/{post.media_files.length}
				</div>
			{/if}
		</div>
	{/if}

	<div class="flex-1">
		<a href="/{clientId}/social/{post.filename}" class="hover:text-indigo-600 block transition-colors">
			<h4 class="font-semibold text-slate-900 dark:text-slate-100 mb-2 leading-snug">{post.title}</h4>
		</a>
		{#if isDraft}
			<p class="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-4">{post.content}</p>
		{/if}
	</div>

	<div class="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700/50 mt-auto">
		{#if isDraft}
			<label class="cursor-pointer text-xs flex items-center gap-1.5 text-slate-500 hover:text-indigo-600">
				<ImageIcon class="w-3.5 h-3.5" /> Attach Media
				<input type="file" multiple class="hidden" accept="image/*,video/*" onchange={(e) => onUpload(e, post.id, post.filename)} />
			</label>
		{:else}
			<button
				onclick={() => onUpdateStatus(post.id, post.filename, 'draft')}
				class="text-xs text-slate-400 hover:text-slate-700"
			>
				Back to draft
			</button>
		{/if}

		<div class="flex items-center gap-1 -mr-1">
			<button
				onclick={() => onDelete(post.id, post.filename)}
				title="Delete Post"
				class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
			>
				<Trash2 class="w-4 h-4" />
			</button>
			<a
				href="/{clientId}/social/{post.filename}"
				title="Edit Post"
				class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
			>
				<FileEdit class="w-4 h-4" />
			</a>
			{#if isDraft}
				<button 
					onclick={() => onUpdateStatus(post.id, post.filename, 'approved')}
					title="Approve Post"
					class="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors"
				>
					<CheckCircle class="w-4 h-4" />
				</button>
			{:else}
				<button class="text-xs flex items-center gap-1 bg-slate-900 text-white hover:bg-slate-800 px-3 py-1.5 rounded-md font-medium shadow-sm transition-colors ml-1">
					Publish <Send class="w-3 h-3 ml-0.5" />
				</button>
			{/if}
		</div>
	</div>
</div>