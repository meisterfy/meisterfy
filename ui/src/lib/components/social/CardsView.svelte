<script lang="ts">
	import PostCard from './PostCard.svelte';

	let { posts, clientId, onUpdateStatus, onDelete, onUpload } = $props<{
		posts: any[];
		clientId: string;
		onUpdateStatus: (id: string, filename: string, status: string) => void;
		onDelete: (id: string, filename: string) => void;
		onUpload: (event: Event, id: string, filename: string) => void;
	}>();
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
	{#each posts as post (post.id)}
		<PostCard {post} {clientId} {onUpdateStatus} {onDelete} {onUpload} />
	{/each}
</div>