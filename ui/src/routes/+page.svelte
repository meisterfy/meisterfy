<script lang="ts">
	import type { PageData } from './$types';
	import { Building2, FileEdit, CheckCircle } from 'lucide-svelte';

	let { data } = $props<{ data: PageData }>();
</script>

<div class="h-14 flex items-center px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-10">
	<h2 class="font-semibold text-lg">Dashboard</h2>
</div>

<div class="flex-1 overflow-y-auto p-6">
	<div class="max-w-5xl mx-auto space-y-6">
		<div>
			<h3 class="text-xl font-bold text-slate-900 dark:text-white mb-1">Your Clients</h3>
			<p class="text-sm text-slate-500">Select a client to manage their content.</p>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each data.clients as client}
				<a href="/{client.id}/social" class="block group">
					<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-slate-400 dark:hover:border-slate-600 transition-all shadow-sm group-hover:shadow-md">
						<div class="flex items-start justify-between mb-4">
							<div class="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
								<Building2 class="w-5 h-5" />
							</div>
						</div>
						
						<h4 class="font-bold text-lg mb-1">{client.brand.name || client.id}</h4>
						<p class="text-sm text-slate-500 mb-4">{client.brand.niche || 'Niche not set'}</p>
						
						<div class="flex items-center gap-4 text-sm pt-4 border-t border-slate-100 dark:border-slate-800">
							<div class="flex items-center gap-1.5 text-amber-600">
								<FileEdit class="w-4 h-4" />
								<span class="font-medium">{client.drafts} Drafts</span>
							</div>
							<div class="flex items-center gap-1.5 text-emerald-600">
								<CheckCircle class="w-4 h-4" />
								<span class="font-medium">{client.approved} Approved</span>
							</div>
						</div>
					</div>
				</a>
			{/each}

			{#if data.clients.length === 0}
				<div class="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
					<p class="text-slate-500 font-medium">No clients found.</p>
					<p class="text-sm text-slate-400 mt-1">Run the CLI agent to create a client and post.</p>
				</div>
			{/if}
		</div>
	</div>
</div>
