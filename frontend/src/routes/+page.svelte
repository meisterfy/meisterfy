<script lang="ts">
	import { resolve } from '$app/paths'
	import { Building2, Plus, ArrowRight, Settings } from 'lucide-svelte'
	import ProviderIcon from '$lib/components/ui/provider-icon.svelte'
	import Toolbar from '$lib/components/ui/toolbar/toolbar.svelte'
	import type { PageData } from './$types'
	import ProfileLink from '$lib/components/ui/toolbar/link/profile.svelte'

	let { data } = $props<{ data: PageData }>()
	let tenants = $derived(data.tenants ?? [])

	function getInitials(name: string) {
		return name
			.split(' ')
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase()
	}
</script>

<div class="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
	<Toolbar>
		{#snippet header()}
			<div class="flex items-center gap-3">
				<div class="h-12 w-12">
					<img src="/logo.svg" alt="Mkt Maestro" class="h-full w-full object-contain" />
				</div>
				<h1 class="text-lg font-bold text-slate-900 uppercase dark:text-white">Maestro</h1>
			</div>

			<div class="flex items-center gap-2">
				<a
					href={resolve('/tenants/new')}
					class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
				>
					<Plus class="h-4 w-4" />
					<span class="hidden sm:inline">New Client</span>
				</a>
				<a
					href={resolve('/settings')}
					class="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
					title="Global Settings"
				>
					<Settings class="h-4 w-4" />
				</a>
				<ProfileLink />
			</div>
		{/snippet}
	</Toolbar>

	<main class="flex-1 overflow-y-auto">
		<div class="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 xl:max-w-[1600px]">
			<div class="mt-8 mb-4">
				<h2 class="text-2xl font-bold tracking-tight text-slate-900 lg:text-4xl dark:text-white">
					Welcome back!
				</h2>
				<p class="mt-1 text-slate-500 lg:text-lg dark:text-slate-400">Select a client to manage</p>
			</div>

			{#if tenants.length === 0}
				<div
					class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-slate-800"
				>
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-900/20"
					>
						<Building2 class="h-8 w-8 text-indigo-500" />
					</div>
					<h3 class="text-lg font-semibold text-slate-900 dark:text-white">No clients found</h3>
					<p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
						Get started by creating your first client account.
					</p>
					<a
						href={resolve('/tenants/new')}
						class="mt-6 flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
					>
						<Plus class="h-4 w-4" /> Create Client
					</a>
				</div>
			{:else}
				<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{#each tenants as tenant (tenant.id)}
						<a
							href={resolve(`/${tenant.id}/social`)}
							class="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/50"
						>
							<div class="p-6">
								<div class="mb-5 flex items-start justify-between">
									<div
										class="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-base font-bold text-indigo-600 shadow-sm transition-colors group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-900/30 dark:text-indigo-400 dark:group-hover:bg-indigo-500 dark:group-hover:text-white"
									>
										{getInitials(tenant.name)}
									</div>
									<div
										class="rounded-full bg-slate-50 p-2 text-slate-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:bg-slate-800 dark:group-hover:bg-indigo-900/30"
									>
										<ArrowRight class="h-4 w-4" />
									</div>
								</div>

								<h3
									class="text-lg font-bold text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400"
								>
									{tenant.name}
								</h3>

								<!-- Connectors stack -->
								<div class="mt-6 flex items-center -space-x-2.5 overflow-hidden">
									{#each tenant.connectors as conn (conn.name)}
										<div
											class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-white p-1.5 shadow-sm dark:border-slate-900 dark:bg-slate-800"
											title={conn.name}
										>
											<ProviderIcon provider={conn.id} />
										</div>
									{/each}

									{#if tenant.connectors.length === 0}
										<div class="text-[10px] font-medium tracking-tight text-slate-400 uppercase">
											No connectors
										</div>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</main>
</div>
