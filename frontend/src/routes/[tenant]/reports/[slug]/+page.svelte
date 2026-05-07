<script lang="ts">
	import { ArrowLeft, FileText, Calendar, Download } from 'lucide-svelte'
	import type { PageData } from './$types'

	let { data } = $props<{ data: PageData }>()
</script>

<div
	class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8 print:max-w-none print:px-0 print:py-0"
>
	<!-- Back + Download (hidden on print) -->
	<div class="mb-6 flex items-center justify-between print:hidden">
		<a
			href="/{data.tenant}/reports"
			class="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
		>
			<ArrowLeft class="h-4 w-4" /> All reports
		</a>

		<button
			onclick={() => window.print()}
			class="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm
				font-medium text-slate-700 transition-colors hover:bg-slate-200
				dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
		>
			<Download class="h-4 w-4" /> Download PDF
		</button>
	</div>

	<!-- Report title (visible in print too) -->
	<div class="mb-6 flex items-start gap-3 print:mb-8">
		<div
			class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30 print:hidden"
		>
			<FileText class="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
		</div>
		<div>
			<h1 class="text-xl leading-snug font-bold text-slate-900 dark:text-white print:text-2xl">
				{data.slug}
			</h1>
			{#if data.date}
				<div class="mt-1 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
					<Calendar class="h-3.5 w-3.5 print:hidden" />
					<time>{data.date}</time>
				</div>
			{/if}
		</div>
	</div>

	<!-- Divider -->
	<div class="mb-8 border-t border-slate-200 dark:border-slate-800"></div>

	<!-- Report prose -->
	<article
		class="prose prose-slate dark:prose-invert prose-headings:font-bold
		prose-h1:text-2xl
		prose-h2:text-xl prose-h3:text-lg prose-a:text-indigo-600
		dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline prose-code:bg-slate-100
		dark:prose-code:bg-slate-800 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-pre:bg-slate-900
		dark:prose-pre:bg-slate-950 prose-blockquote:border-indigo-300
		dark:prose-blockquote:border-indigo-700 prose-th:text-left
		prose-th:font-semibold prose-table:text-sm
		print:prose-sm
		max-w-none
	"
	>
		{@html data.html}
	</article>
</div>
