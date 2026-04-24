<script lang="ts">
	import { ArrowLeft, Cog } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	let { children } = $props<{ children: Snippet }>();
</script>

<div class="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
	<header class="sticky top-0 z-50 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 print:hidden">
		<div class="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
			<a
				href="/"
				class="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
				title="Back to app"
			>
				<ArrowLeft class="h-4 w-4" />
			</a>
			<div class="flex items-center gap-2">
				<Cog class="h-5 w-5 text-slate-400" />
				<span class="text-base font-bold text-slate-900 dark:text-white">App Settings</span>
			</div>
		</div>
	</header>

	<main class="flex flex-1 flex-col">
		{@render children()}
	</main>
</div>
