<script lang="ts">
	import type { PageData } from './$types'
	import { type PostShape } from '$lib/social'
	import CalendarWidget from '$lib/components/social/calendar-widget.svelte'
	import NewPostDrawer from '$lib/components/social/new-post-drawer.svelte'
	import EditPostDrawer from '$lib/components/social/edit-post-drawer.svelte'

	let { data } = $props<{ data: PageData }>()

	let scheduled = $state<PostShape[]>([])
	let isLoading = $state(true)

	$effect(() => {
		data.scheduled.then((p: PostShape[]) => {
			scheduled = p
			isLoading = false
		})
	})

	// ── Drawer state ──────────────────────────────────────────────────────────
	let showNewPostDrawer = $state(false)
	let newPostDate = $state('')
	let showEditDrawer = $state(false)
	let selectedPost = $state<PostShape | null>(null)

	function openNewPostDrawer(date: string) {
		newPostDate = date
		showNewPostDrawer = true
	}

	function openPostDrawer(post: PostShape) {
		selectedPost = post
		showEditDrawer = true
	}

	$effect(() => {
		if (!showEditDrawer) selectedPost = null
	})
</script>

<div class="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
	<CalendarWidget
		posts={scheduled}
		{isLoading}
		onCreatePost={openNewPostDrawer}
		onEditPost={openPostDrawer}
	/>
</div>

<NewPostDrawer
	bind:open={showNewPostDrawer}
	tenant={data.tenant}
	defaultDate={newPostDate}
	onCreated={(p) => {
		scheduled = [...scheduled, p]
	}}
/>

<EditPostDrawer
	bind:open={showEditDrawer}
	post={selectedPost}
	tenant={data.tenant}
	onSaved={(updated) => {
		scheduled = scheduled.map((p) => (p.id === updated.id ? updated : p))
	}}
	onDeleted={(id) => {
		scheduled = scheduled.filter((p) => p.id !== id)
	}}
/>
