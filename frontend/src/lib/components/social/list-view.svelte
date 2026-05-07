<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { FileEdit, CheckCircle, Trash2, Send, Image as ImageIcon } from 'lucide-svelte'

	let { posts, clientId, onUpdateStatus, onDelete, onUpload } = $props<{
		posts: any[]
		clientId: string
		onUpdateStatus: (id: string, filename: string, status: string) => void
		onDelete: (id: string, filename: string) => void
		onUpload: (event: Event, id: string, filename: string) => void
	}>()
</script>

<div
	class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
>
	<div class="overflow-x-auto">
		<table class="w-full text-left text-sm">
			<thead
				class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-800/50"
			>
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
					<tr class="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
						<td class="px-6 py-4 font-mono text-slate-500">{post.id.split('_')[0]}</td>
						<td class="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
							<a href="/{clientId}/social/{post.filename}" class="hover:text-indigo-600"
								>{post.title}</a
							>
						</td>
						<td class="px-6 py-4">
							{#if post.status === 'draft'}
								<span
									class="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-300"
									>Draft</span
								>
							{:else}
								<span
									class="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-600 uppercase dark:bg-emerald-900/30 dark:text-emerald-400"
									>Approved</span
								>
							{/if}
						</td>
						<td class="px-6 py-4">
							{#if post.media_files?.length > 0}
								<span class="flex items-center gap-1 text-xs font-medium text-emerald-600">
									<ImageIcon class="h-3.5 w-3.5" />
									{post.media_files.length}
								</span>
							{:else}
								<label
									class="flex cursor-pointer items-center gap-1 text-xs font-medium text-amber-500 hover:text-amber-600"
								>
									<ImageIcon class="h-3.5 w-3.5" /> Add
									<input
										type="file"
										multiple
										class="hidden"
										accept="image/*,video/*"
										onchange={(e) => onUpload(e, post.id, post.filename)}
									/>
								</label>
							{/if}
						</td>
						<td class="px-6 py-4 text-right">
							<div class="flex items-center justify-end gap-2">
								{#if post.status === 'draft'}
									<button
										onclick={() => onUpdateStatus(post.id, post.filename, 'approved')}
										title="Approve Post"
										class="rounded p-1.5 text-emerald-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30"
									>
										<CheckCircle class="h-4 w-4" />
									</button>
								{:else}
									<button
										onclick={() => onUpdateStatus(post.id, post.filename, 'draft')}
										title="Back to Draft"
										class="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
									>
										<FileEdit class="h-4 w-4" />
									</button>
								{/if}

								<a
									href="/{clientId}/social/{post.filename}"
									title="Edit Post"
									class="rounded p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30"
								>
									<FileEdit class="h-4 w-4" />
								</a>
								<button
									onclick={() => onDelete(post.id, post.filename)}
									title="Delete Post"
									class="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
								>
									<Trash2 class="h-4 w-4" />
								</button>

								{#if post.status === 'approved'}
									<button
										class="ml-2 flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
									>
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
