<script lang="ts">
	import { auth, type PendingTerms } from '$lib/stores/auth.svelte'
	import { goto } from '$app/navigation'
	import { m } from '$lib/paraglide/messages'
	import { Button } from '$lib/components/ui/button/index.js'

	let { terms }: { terms: PendingTerms } = $props()

	let agreed = $state(false)
	let loading = $state(false)

	async function handleAccept() {
		if (!agreed || loading) return
		loading = true
		try {
			await auth.acceptTerms(terms.version_id)
		} finally {
			loading = false
		}
	}

	function handleLogout() {
		auth.clear()
		goto('/login')
	}
</script>

<div class="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950">
	<header class="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
		<h1 class="text-xl font-bold text-slate-900 dark:text-white">
			{m['globals:terms:update_title']()}
		</h1>
	</header>

	<div class="flex-1 overflow-y-auto px-6 py-6">
		<div class="mx-auto max-w-3xl space-y-8">
			{#each terms.blocks as block (block.title)}
				<section>
					<h2 class="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
						{block.title}
					</h2>
					<p class="whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-400">
						{block.content}
					</p>
				</section>
			{/each}
		</div>
	</div>

	<footer class="border-t border-slate-200 px-6 py-4 dark:border-slate-800">
		<div class="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<label class="flex cursor-pointer items-center gap-3">
				<input
					type="checkbox"
					bind:checked={agreed}
					class="h-4 w-4 rounded border-slate-300 accent-indigo-600"
				/>
				<span class="text-sm text-slate-700 dark:text-slate-300">
					{m['globals:terms:agree_checkbox']()}
				</span>
			</label>
			<div class="flex items-center gap-3">
				<button
					onclick={handleLogout}
					class="text-sm text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
				>
					{m['globals:terms:logout']()}
				</button>
				<Button onclick={handleAccept} disabled={!agreed || loading}>
					{m['globals:terms:continue']()}
				</Button>
			</div>
		</div>
	</footer>
</div>
