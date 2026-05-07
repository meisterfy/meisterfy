<script lang="ts">
	import PostCard from './post-card.svelte'
	import { FileEdit, CheckCircle } from 'lucide-svelte'

	let { posts, clientId, onUpdateStatus, onDelete, onUpload } = $props<{
		posts: any[]
		clientId: string
		onUpdateStatus: (id: string, filename: string, status: string) => void
		onDelete: (id: string, filename: string) => void
		onUpload: (event: Event, id: string, filename: string) => void
	}>()

	let drafts = $derived(posts.filter((p: any) => p.status === 'draft'))
	let approved = $derived(posts.filter((p: any) => p.status === 'approved'))
</script>

<div class="flex h-full w-max min-w-full gap-6">
	<!-- Drafts Column -->
	<div class="flex h-full w-80 flex-col rounded-xl bg-slate-100/50 dark:bg-slate-900/50">
		<div class="flex items-center gap-2 border-b border-slate-200/50 p-4 dark:border-slate-800/50">
			<FileEdit class="h-4 w-4 text-amber-600" />
			<h3 class="font-bold text-slate-700 dark:text-slate-300">Drafts</h3>
			<span
				class="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-800"
				>{drafts.length}</span
			>
		</div>
		<div class="flex-1 space-y-4 overflow-y-auto p-4">
			{#each drafts as post (post.id)}
				<PostCard {post} {clientId} {onUpdateStatus} {onDelete} {onUpload} stretch={false} />
			{/each}
		</div>
	</div>

	<!-- Approved Column -->
	<div class="flex h-full w-80 flex-col rounded-xl bg-slate-100/50 dark:bg-slate-900/50">
		<div class="flex items-center gap-2 border-b border-slate-200/50 p-4 dark:border-slate-800/50">
			<CheckCircle class="h-4 w-4 text-emerald-600" />
			<h3 class="font-bold text-slate-700 dark:text-slate-300">Approved</h3>
			<span
				class="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-800"
				>{approved.length}</span
			>
		</div>
		<div class="flex-1 space-y-4 overflow-y-auto p-4">
			{#each approved as post (post.id)}
				<PostCard {post} {clientId} {onUpdateStatus} {onDelete} {onUpload} stretch={false} />
			{/each}
		</div>
	</div>
</div>
