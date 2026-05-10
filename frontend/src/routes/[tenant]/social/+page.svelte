<script lang="ts">
	import ProviderIcon from '@/lib/components/ui/provider-icon.svelte'
	import { ChevronLeft, ChevronRight, Plus } from 'lucide-svelte'
	import type { PageData } from './$types'
	import { normPlatforms, type PostPlatform, type PostShape } from '$lib/social'
	import type { Post } from '$lib/api/posts'
	import Skeleton from '$lib/components/ui/skeleton.svelte'
	import NewPostDrawer from '$lib/components/social/new-post-drawer.svelte'
	import EditPostDrawer from '$lib/components/social/edit-post-drawer.svelte'

	let { data } = $props<{ data: PageData }>()

	// ── Calendar state ────────────────────────────────────────────────────────
	const today = new Date()
	let viewYear = $state(today.getFullYear())
	let viewMonth = $state(today.getMonth())

	const MONTHS = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	]
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

	let scheduled = $state<PostShape[]>([])
	let isLoading = $state(true)

	$effect(() => {
		data.scheduled.then((p: Post[]) => {
			scheduled = p as unknown as PostShape[]
			isLoading = false
		})
	})

	const calendarCells = $derived.by(() => {
		const firstDay = new Date(viewYear, viewMonth, 1).getDay()
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
		const byDate = new Map<string, PostShape[]>()
		for (const p of scheduled) {
			if (!p.scheduled_date) continue
			if (!byDate.has(p.scheduled_date)) byDate.set(p.scheduled_date, [])
			byDate.get(p.scheduled_date)!.push(p)
		}
		const cells: Array<{ date: string | null; day: number | null; posts: PostShape[] }> = []
		for (let i = 0; i < firstDay; i++) cells.push({ date: null, day: null, posts: [] })
		for (let d = 1; d <= daysInMonth; d++) {
			const mm = String(viewMonth + 1).padStart(2, '0')
			const dd = String(d).padStart(2, '0')
			const date = `${viewYear}-${mm}-${dd}`
			cells.push({ date, day: d, posts: byDate.get(date) ?? [] })
		}
		while (cells.length % 7 !== 0) cells.push({ date: null, day: null, posts: [] })
		return cells
	})

	function prevMonth() {
		if (viewMonth === 0) {
			viewMonth = 11
			viewYear--
		} else viewMonth--
	}
	function nextMonth() {
		if (viewMonth === 11) {
			viewMonth = 0
			viewYear++
		} else viewMonth++
	}
	function goToToday() {
		viewYear = today.getFullYear()
		viewMonth = today.getMonth()
	}
	function isToday(date: string | null) {
		return date === today.toISOString().slice(0, 10)
	}

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
	<!-- Calendar header -->
	<div class="mb-6 flex items-center justify-between">
		<h2 class="text-xl font-bold text-slate-900 dark:text-white">{MONTHS[viewMonth]} {viewYear}</h2>
		<div class="flex items-center gap-1">
			<button
				onclick={prevMonth}
				class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
				><ChevronLeft class="h-5 w-5" /></button
			>
			<button
				onclick={goToToday}
				class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
				>Today</button
			>
			<button
				onclick={nextMonth}
				class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
				><ChevronRight class="h-5 w-5" /></button
			>
		</div>
	</div>

	<!-- Day headers -->
	<div class="mb-1 grid grid-cols-7">
		{#each DAYS as d (d)}
			<div
				class="py-2 text-center text-xs font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500"
			>
				{d}
			</div>
		{/each}
	</div>

	<!-- Calendar grid -->
	<div class="grid grid-cols-7 border-t border-l border-slate-200 dark:border-slate-800">
		{#each calendarCells as cell, i (cell.date || 'empty-' + i)}
			<div
				class="group/cell relative min-h-[110px] border-r border-b border-slate-200 p-1.5 dark:border-slate-800 {cell.date
					? 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/40'
					: 'bg-slate-50 dark:bg-slate-950'}"
			>
				{#if cell.day}
					<div class="mb-1 flex items-center justify-between px-0.5">
						<span
							class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold {isToday(
								cell.date
							)
								? 'bg-indigo-500 text-white'
								: 'text-slate-500 dark:text-slate-400'}">{cell.day}</span
						>
						<button
							onclick={() => openNewPostDrawer(cell.date!)}
							class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 transition-colors group-hover:bg-indigo-50 dark:bg-slate-800 dark:group-hover:bg-indigo-900/20"
						>
							<Plus class="h-3.5 w-3.5" />
						</button>
					</div>
					<div class="flex flex-col gap-0.5">
						{#if isLoading}
							<div class="space-y-1.5 px-0.5 pt-1">
								<Skeleton class="h-3 w-full rounded-sm" />
								<Skeleton class="h-3 w-[85%] rounded-sm" />
							</div>
						{:else}
							{#each cell.posts.slice(0, 3) as post (post.id)}
								<button
									onclick={() => openPostDrawer(post)}
									class="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left opacity-100 transition-opacity hover:opacity-80"
									style="background: {post.status === 'published'
										? 'rgb(220 252 231)'
										: 'rgb(254 243 199)'}"
								>
									{#each normPlatforms(post.platform).slice(0, 2) as plt (plt)}
										{@render PlatformDot({ platform: plt })}
									{/each}
									<span class="truncate text-[10px] font-medium text-slate-700"
										>{post.title}</span
									>
								</button>
							{/each}
							{#if cell.posts.length > 3}
								<span class="pl-1 text-[10px] text-slate-400">+{cell.posts.length - 3} more</span>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Legend -->
	<div class="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
		<span class="flex items-center gap-1.5"
			><span class="h-2 w-2 rounded-sm border border-amber-300 bg-amber-100"></span> Scheduled</span
		>
		<span class="flex items-center gap-1.5"
			><span class="h-2 w-2 rounded-sm border border-emerald-300 bg-emerald-100"></span> Published</span
		>
		<span class="flex items-center gap-1.5">
			<ProviderIcon provider="instagram" class="h-3 w-3 text-[#E1306C]" />
			Instagram
		</span>
		<span class="flex items-center gap-1.5">
			<ProviderIcon provider="facebook" class="h-3 w-3 text-[#1877F2]" />
			Facebook
		</span>
		<span class="flex items-center gap-1.5">
			<ProviderIcon provider="linkedin" class="h-3 w-3 text-[#0A66C2]" />
			LinkedIn
		</span>
	</div>
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

{#snippet PlatformDot(props: { platform: PostPlatform })}
	{@const plt = props.platform}
	<ProviderIcon
		provider={plt}
		class="h-2.5 w-2.5 shrink-0 {plt === 'instagram_feed'
			? 'text-[#E1306C]'
			: plt === 'instagram_stories'
				? 'text-[#C13584]'
				: plt === 'instagram_reels'
					? 'text-[#FF0000]'
					: plt === 'facebook'
						? 'text-[#1877F2]'
						: 'text-[#0A66C2]'}"
	/>
{/snippet}
