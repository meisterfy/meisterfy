<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import type { PageData } from './$types';
	import type { PostWithMeta, PostPlatform } from '$lib/server/db';

	let { data } = $props<{ data: PageData }>();

	// ── Calendar state ────────────────────────────────────────────────────────
	const today = new Date();
	let viewYear  = $state(today.getFullYear());
	let viewMonth = $state(today.getMonth()); // 0-indexed

	const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
	const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

	// Build calendar grid (42 cells = 6 weeks)
	const calendarCells = $derived.by(() => {
		const firstDay = new Date(viewYear, viewMonth, 1).getDay();
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const cells: Array<{ date: string | null; day: number | null }> = [];

		for (let i = 0; i < firstDay; i++) cells.push({ date: null, day: null });
		for (let d = 1; d <= daysInMonth; d++) {
			const mm = String(viewMonth + 1).padStart(2, '0');
			const dd = String(d).padStart(2, '0');
			cells.push({ date: `${viewYear}-${mm}-${dd}`, day: d });
		}
		while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
		return cells;
	});

	// Group posts by date
	const postsByDate = $derived.by(() => {
		const map = new Map<string, PostWithMeta[]>();
		for (const p of data.scheduled) {
			if (!p.scheduled_date) continue;
			if (!map.has(p.scheduled_date)) map.set(p.scheduled_date, []);
			map.get(p.scheduled_date)!.push(p);
		}
		return map;
	});

	function prevMonth() {
		if (viewMonth === 0) { viewMonth = 11; viewYear--; }
		else viewMonth--;
	}

	function nextMonth() {
		if (viewMonth === 11) { viewMonth = 0; viewYear++; }
		else viewMonth++;
	}

	function isToday(date: string | null): boolean {
		if (!date) return false;
		return date === today.toISOString().slice(0, 10);
	}

	// ── Platform config ───────────────────────────────────────────────────────
	const PLATFORM: Record<PostPlatform, { label: string; color: string }> = {
		instagram_feed:    { label: 'IG Feed',    color: 'bg-pink-500' },
		instagram_stories: { label: 'IG Stories', color: 'bg-purple-500' },
		instagram_reels:   { label: 'IG Reels',   color: 'bg-rose-500' },
		linkedin:          { label: 'LinkedIn',   color: 'bg-blue-600' },
		facebook:          { label: 'Facebook',   color: 'bg-blue-500' },
	};

	const STATUS_COLOR: Record<string, string> = {
		scheduled: 'bg-amber-400',
		published:  'bg-emerald-400',
	};

	// ── Detail modal ──────────────────────────────────────────────────────────
	let selectedPost = $state<PostWithMeta | null>(null);
</script>

<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">

	<!-- Calendar header -->
	<div class="flex items-center justify-between mb-6">
		<h2 class="text-xl font-bold text-slate-900 dark:text-white">
			{MONTHS[viewMonth]} {viewYear}
		</h2>
		<div class="flex items-center gap-1">
			<button
				onclick={prevMonth}
				class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
			>
				<ChevronLeft class="w-5 h-5" />
			</button>
			<button
				onclick={() => { viewYear = today.getFullYear(); viewMonth = today.getMonth(); }}
				class="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
			>
				Today
			</button>
			<button
				onclick={nextMonth}
				class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
			>
				<ChevronRight class="w-5 h-5" />
			</button>
		</div>
	</div>

	<!-- Grid header (days of week) -->
	<div class="grid grid-cols-7 mb-1">
		{#each DAYS as d}
			<div class="text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-2">
				{d}
			</div>
		{/each}
	</div>

	<!-- Calendar grid -->
	<div class="grid grid-cols-7 border-l border-t border-slate-200 dark:border-slate-800">
		{#each calendarCells as cell}
			{@const posts = cell.date ? (postsByDate.get(cell.date) ?? []) : []}
			<div
				class="border-r border-b border-slate-200 dark:border-slate-800 min-h-[100px] p-1.5 {cell.date ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-950'}"
			>
				{#if cell.day}
					<!-- Day number -->
					<div class="flex items-center justify-center mb-1">
						<span class="text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full {isToday(cell.date) ? 'bg-indigo-500 text-white' : 'text-slate-500 dark:text-slate-400'}">
							{cell.day}
						</span>
					</div>

					<!-- Posts for this day -->
					<div class="flex flex-col gap-0.5">
						{#each posts.slice(0, 3) as post (post.id)}
							<button
								onclick={() => selectedPost = post}
								class="w-full text-left rounded px-1.5 py-0.5 flex items-center gap-1.5 hover:opacity-80 transition-opacity group"
								style="background: {post.status === 'published' ? 'rgb(220 252 231)' : 'rgb(254 243 199)'}"
							>
								{#if post.platform && PLATFORM[post.platform]}
									<span class="w-1.5 h-1.5 rounded-full shrink-0 {PLATFORM[post.platform].color}"></span>
								{/if}
								<span class="text-[10px] font-medium truncate text-slate-700 dark:text-slate-700">
									{post.title}
								</span>
							</button>
						{/each}
						{#if posts.length > 3}
							<span class="text-[10px] text-slate-400 pl-1">+{posts.length - 3} more</span>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Legend -->
	<div class="flex items-center gap-4 mt-4 text-xs text-slate-500">
		<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm bg-amber-100 border border-amber-300"></span> Scheduled</span>
		<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm bg-emerald-100 border border-emerald-300"></span> Published</span>
		{#each Object.entries(PLATFORM) as [key, val]}
			<span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full {val.color}"></span> {val.label}</span>
		{/each}
	</div>
</div>

<!-- Post detail modal -->
{#if selectedPost}
	<div
		class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
		onclick={() => selectedPost = null}
		onkeydown={e => e.key === 'Escape' && (selectedPost = null)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 relative"
			onclick={e => e.stopPropagation()}
			onkeydown={e => e.stopPropagation()}
			role="presentation"
		>
			<div class="flex items-start justify-between gap-4 mb-4">
				<div>
					<p class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
						{selectedPost.platform ? PLATFORM[selectedPost.platform]?.label : '—'}
						{#if selectedPost.scheduled_date}
							· {selectedPost.scheduled_date}{selectedPost.scheduled_time ? ' ' + selectedPost.scheduled_time : ''}
						{/if}
					</p>
					<h3 class="text-lg font-bold text-slate-900 dark:text-white">{selectedPost.title}</h3>
				</div>
				<span class="text-xs px-2 py-0.5 rounded-full font-bold uppercase {selectedPost.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
					{selectedPost.status}
				</span>
			</div>

			<p class="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mb-4">
				{selectedPost.content}
			</p>

			{#if selectedPost.hashtags?.length}
				<p class="text-xs text-indigo-500 dark:text-indigo-400 flex flex-wrap gap-1">
					{#each selectedPost.hashtags as tag}
						<span>{tag}</span>
					{/each}
				</p>
			{/if}

			<button
				onclick={() => selectedPost = null}
				class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
			>
				✕
			</button>
		</div>
	</div>
{/if}
