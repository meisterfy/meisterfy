<script lang="ts">
	import { Dialog } from 'bits-ui'
	import { Plus, X } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'
	import { getAvailableMetaPages, activateMetaPage } from '$lib/api/social-accounts'
	import type { MetaPage, ConnectorResource } from '$lib/api/social-accounts'

	let {
		open = $bindable(false),
		tenant,
		onAdded
	}: {
		open: boolean
		tenant: string
		onAdded: (resource: ConnectorResource) => void
	} = $props()

	let pages = $state<MetaPage[]>([])
	let loading = $state(false)
	let error = $state<string | null>(null)
	let search = $state('')
	let addingId = $state<string | null>(null)
	let addError = $state<string | null>(null)

	$effect(() => {
		if (open) {
			search = ''
			addError = null
			loadPages()
		}
	})

	async function loadPages() {
		loading = true
		error = null
		try {
			pages = await getAvailableMetaPages(tenant)
		} catch {
			error = m['settings:social_picker_error']()
		} finally {
			loading = false
		}
	}

	let filtered = $derived(
		search.trim()
			? pages.filter(
					(p) =>
						p.page_name.toLowerCase().includes(search.toLowerCase()) ||
						(p.ig_username ?? '').toLowerCase().includes(search.toLowerCase())
				)
			: pages
	)

	async function add(page: MetaPage) {
		addingId = page.page_id
		addError = null
		try {
			const resource = await activateMetaPage(tenant, {
				page_id: page.page_id,
				page_name: page.page_name,
				ig_user_id: page.ig_user_id,
				ig_username: page.ig_username
			})
			pages = pages.map((p) => (p.page_id === page.page_id ? { ...p, already_connected: true } : p))
			onAdded(resource)
			open = false
		} catch (err) {
			addError = err instanceof Error ? err.message : m['globals:error_generic']()
		} finally {
			addingId = null
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] transition-opacity data-[state=closed]:opacity-0 data-[state=open]:opacity-100"
		/>
		<Dialog.Content
			class="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl max-md:inset-x-0 max-md:inset-y-auto max-md:bottom-0 max-md:max-h-[90vh] max-md:max-w-none max-md:rounded-t-2xl dark:bg-slate-900"
		>
			<div class="border-border/30 flex items-center justify-between border-b p-4">
				<Dialog.Title class="text-base font-semibold text-slate-900 dark:text-white">
					{m['settings:social_picker_title']()}
				</Dialog.Title>
				<Dialog.Close
					class="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
				>
					<X class="h-5 w-5" />
				</Dialog.Close>
			</div>

			<div class="border-border/30 border-b p-4">
				<input
					type="search"
					placeholder={m['settings:social_picker_search']()}
					bind:value={search}
					class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
				/>
			</div>

			<div class="flex-1 overflow-y-auto p-4">
				{#if loading}
					<p class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
						{m['settings:social_picker_loading']()}
					</p>
				{:else if error}
					<p
						class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
					>
						{error}
					</p>
				{:else if filtered.length === 0}
					<p class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
						{m['settings:social_picker_empty']()}
					</p>
				{:else}
					<ul class="divide-y divide-slate-100 dark:divide-slate-800">
						{#each filtered as page (page.page_id)}
							<li class="flex items-center gap-3 py-3">
								<div class="flex shrink-0 items-center gap-1">
									{#if page.ig_user_id}
										<span
											class="rounded bg-pink-100 px-1.5 py-0.5 text-[10px] font-bold text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
											>IG</span
										>
									{/if}
									<span
										class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
										>FB</span
									>
								</div>

								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-slate-900 dark:text-white">
										{page.page_name}
									</p>
									{#if page.ig_username}
										<p class="text-xs text-slate-500 dark:text-slate-400">@{page.ig_username}</p>
									{/if}
								</div>

								{#if page.already_connected}
									<span
										class="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"
									>
										{m['settings:social_picker_connected']()}
									</span>
								{:else}
									<button
										type="button"
										disabled={addingId === page.page_id}
										onclick={() => add(page)}
										class="flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
									>
										<Plus class="h-3.5 w-3.5" />
										{m['settings:social_picker_add']()}
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}

				{#if addError}
					<p
						class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
					>
						{addError}
					</p>
				{/if}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
