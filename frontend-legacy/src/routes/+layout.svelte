<script lang="ts">
	import '../app.css'
	import { onMount } from 'svelte'
	import { Toaster } from '$lib/components/ui/sonner'
	import { ModeWatcher } from 'mode-watcher'
	import { auth } from '$lib/stores/auth.svelte'
	import TermsWall from '$lib/components/ui/terms-wall/terms-wall.svelte'

	let { children } = $props()

	let showTermsWall = $derived(auth.isAuthenticated && auth.pendingTerms !== null)

	onMount(() => {
		const overlay = document.getElementById('app-loading')
		if (overlay) {
			overlay.classList.add('done')
			setTimeout(() => overlay.remove(), 220)
		}
	})
</script>

<div
	class="flex min-h-screen w-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50 print:block print:h-auto print:overflow-visible"
>
	{#if showTermsWall}
		<TermsWall terms={auth.pendingTerms!} />
	{:else}
		{@render children()}
	{/if}
	<Toaster richColors closeButton position="bottom-right" />
	<ModeWatcher />
</div>
