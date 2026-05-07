<script lang="ts">
	import { FileText } from 'lucide-svelte'
	import type { PageData } from './$types'

	let { data } = $props<{ data: PageData }>()

	const COLOR_CLASSES: Record<string, { badge: string; dot: string }> = {
		amber: {
			badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
			dot: 'bg-amber-400'
		},
		blue: {
			badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
			dot: 'bg-blue-400'
		},
		emerald: {
			badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
			dot: 'bg-emerald-400'
		},
		violet: {
			badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
			dot: 'bg-violet-400'
		},
		red: {
			badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
			dot: 'bg-red-400'
		},
		slate: {
			badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
			dot: 'bg-slate-400'
		}
	}
</script>

<div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- Header -->
	<div class="mb-8">
		<div class="mb-1 flex items-center gap-3">
			<FileText class="h-6 w-6 text-slate-400" />
			<h2 class="text-2xl font-bold text-slate-900 dark:text-white">Reports</h2>
		</div>
		<p class="ml-9 text-sm text-slate-500 dark:text-slate-400">
			{data.reports.length}
			{data.reports.length === 1 ? 'report' : 'reports'} available
		</p>
	</div>

	{#if data.reports.length === 0}
		<div
			class="rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700"
		>
			<FileText class="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
			<p class="text-sm text-slate-500 dark:text-slate-400">No reports found for this client.</p>
		</div>
	{:else}
		<div class="grid gap-3 sm:grid-cols-2">
			{#each data.reports as report}
				{@const colors = COLOR_CLASSES[report.color] ?? COLOR_CLASSES.slate}
				<a
					href="/{data.tenant}/reports/{report.slug}"
					class="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
				>
					<!-- Icon dot -->
					<div
						class="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 transition-colors group-hover:bg-indigo-50 dark:bg-slate-800 dark:group-hover:bg-indigo-900/20"
					>
						<span class="h-2.5 w-2.5 rounded-full {colors.dot}"></span>
					</div>

					<!-- Content -->
					<div class="min-w-0 flex-1">
						<div class="mb-1 flex flex-wrap items-center gap-2">
							<span class="rounded-full px-2 py-0.5 text-xs font-semibold {colors.badge}">
								{report.label}
							</span>
							{#if report.date}
								<time class="text-xs text-slate-400 tabular-nums dark:text-slate-500"
									>{report.date}</time
								>
							{/if}
						</div>
						<p
							class="truncate text-sm font-semibold text-slate-800 transition-colors group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400"
						>
							{report.title || report.slug}
						</p>
						<p class="mt-0.5 truncate font-mono text-xs text-slate-400 dark:text-slate-500">
							{report.slug}
						</p>
					</div>

					<!-- Arrow -->
					<span
						class="mt-1 text-lg leading-none text-slate-300 transition-colors group-hover:text-indigo-400 dark:text-slate-600"
						>›</span
					>
				</a>
			{/each}
		</div>
	{/if}
</div>
