<script lang="ts">
	import PostCard from './PostCard.svelte';
	import { FileEdit, CheckCircle } from 'lucide-svelte';

	let { posts, clientId, onUpdateStatus, onDelete, onUpload } = $props<{
		posts: any[];
		clientId: string;
		onUpdateStatus: (id: string, filename: string, status: string) => void;
		onDelete: (id: string, filename: string) => void;
		onUpload: (event: Event, id: string, filename: string) => void;
	}>();

	let drafts = $derived(posts.filter((p: any) => p.status === 'draft'));
	let approved = $derived(posts.filter((p: any) => p.status === 'approved'));
</script>

<div class="flex gap-6 h-full w-max min-w-full">
	<!-- Drafts Column -->
	<div class="w-80 flex flex-col h-full bg-slate-100/50 dark:bg-slate-900/50 rounded-xl">
		<div class="p-4 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center gap-2">
			<FileEdit class="w-4 h-4 text-amber-600" />
			<h3 class="font-bold text-slate-700 dark:text-slate-300">Drafts</h3>
			<span class="ml-auto bg-slate-200 dark:bg-slate-800 text-xs py-0.5 px-2 rounded-full font-medium">{drafts.length}</span>
		</div>
		<div class="flex-1 overflow-y-auto p-4 space-y-4">
			{#each drafts as post (post.id)}
				<PostCard {post} {clientId} {onUpdateStatus} {onDelete} {onUpload} stretch={false} />
			{/each}
		</div>
	</div>

	<!-- Approved Column -->
	<div class="w-80 flex flex-col h-full bg-slate-100/50 dark:bg-slate-900/50 rounded-xl">
		<div class="p-4 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center gap-2">
			<CheckCircle class="w-4 h-4 text-emerald-600" />
			<h3 class="font-bold text-slate-700 dark:text-slate-300">Approved</h3>
			<span class="ml-auto bg-slate-200 dark:bg-slate-800 text-xs py-0.5 px-2 rounded-full font-medium">{approved.length}</span>
		</div>
		<div class="flex-1 overflow-y-auto p-4 space-y-4">
			{#each approved as post (post.id)}
				<PostCard {post} {clientId} {onUpdateStatus} {onDelete} {onUpload} stretch={false} />
			{/each}
		</div>
	</div>
</div>