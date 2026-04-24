<script lang="ts">
	import { FileEdit, CheckCircle, Trash2, Send, Image as ImageIcon } from 'lucide-svelte';

	let { posts, clientId, onUpdateStatus, onDelete, onUpload } = $props<{
		posts: any[];
		clientId: string;
		onUpdateStatus: (id: string, filename: string, status: string) => void;
		onDelete: (id: string, filename: string) => void;
		onUpload: (event: Event, id: string, filename: string) => void;
	}>();
</script>

<div class="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
	<div class="overflow-x-auto">
		<table class="w-full text-sm text-left">
			<thead class="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 uppercase border-b border-slate-200 dark:border-slate-800">
				<tr>
					<th class="px-6 py-3">Date</th>
					<th class="px-6 py-3">Title</th>
					<th class="px-6 py-3">Status</th>
					<th class="px-6 py-3">Media</th>
					<th class="px-6 py-3 text-right">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200 dark:divide-slate-800">
				{#each posts as post (post.id)}
					<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
						<td class="px-6 py-4 font-mono text-slate-500">{post.id.split('_')[0]}</td>
						<td class="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
							<a href="/{clientId}/social/{post.filename}" class="hover:text-indigo-600">{post.title}</a>
						</td>
						<td class="px-6 py-4">
							{#if post.status === 'draft'}
								<span class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">Draft</span>
							{:else}
								<span class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">Approved</span>
							{/if}
						</td>
						<td class="px-6 py-4">
							{#if post.media_files?.length > 0}
								<span class="text-xs flex items-center gap-1 text-emerald-600 font-medium">
									<ImageIcon class="w-3.5 h-3.5" /> {post.media_files.length}
								</span>
							{:else}
								<label class="cursor-pointer text-xs flex items-center gap-1 text-amber-500 hover:text-amber-600 font-medium">
									<ImageIcon class="w-3.5 h-3.5" /> Add
									<input type="file" multiple class="hidden" accept="image/*,video/*" onchange={(e) => onUpload(e, post.id, post.filename)} />
								</label>
							{/if}
						</td>
						<td class="px-6 py-4 text-right">
							<div class="flex items-center justify-end gap-2">
								{#if post.status === 'draft'}
									<button 
										onclick={() => onUpdateStatus(post.id, post.filename, 'approved')}
										title="Approve Post"
										class="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors"
									>
										<CheckCircle class="w-4 h-4" />
									</button>
								{:else}
									<button
										onclick={() => onUpdateStatus(post.id, post.filename, 'draft')}
										title="Back to Draft"
										class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
									>
										<FileEdit class="w-4 h-4" />
									</button>
								{/if}
								
								<a
									href="/{clientId}/social/{post.filename}"
									title="Edit Post"
									class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
								>
									<FileEdit class="w-4 h-4" />
								</a>
								<button
									onclick={() => onDelete(post.id, post.filename)}
									title="Delete Post"
									class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
								>
									<Trash2 class="w-4 h-4" />
								</button>
								
								{#if post.status === 'approved'}
									<button class="ml-2 text-xs flex items-center gap-1 bg-slate-900 text-white hover:bg-slate-800 px-2 py-1 rounded-md font-medium shadow-sm transition-colors">
										Publish
									</button>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>