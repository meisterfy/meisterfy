<script lang="ts">
	import { page } from '$app/state'
	import { ArrowLeft, Link2, ScrollText } from 'lucide-svelte'
	import type { Snippet } from 'svelte'
	import Toolbar from '$lib/components/ui/toolbar/toolbar.svelte'
	import SubToolbar from '$lib/components/ui/toolbar/sub-toolbar.svelte'
	import SubToolbarLink from '$lib/components/ui/toolbar/sub-toolbar-link.svelte'
	import { auth } from '$lib/stores/auth.svelte'

	import * as m from '$lib/paraglide/messages.js'

	let { children } = $props<{ children: Snippet }>()
	let currentPath = $derived(page.url.pathname)
	let isPlatformAdmin = $derived(auth.user?.system_role === 'platform_admin')
</script>

<div class="flex h-screen w-full flex-col bg-slate-50 dark:bg-slate-950">
	<Toolbar>
		{#snippet header()}
			<button
				onclick={() => (history.length > 1 ? history.back() : (window.location.href = '/'))}
				class="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
				title={m['settings:nav_back_aria']()}
			>
				<ArrowLeft class="h-4 w-4" />
			</button>
			<div class="flex items-center gap-2">
				<Link2 class="h-5 w-5 text-indigo-500" />
				<span class="text-base font-bold text-slate-900 dark:text-white">
					{m['settings:title']()}
				</span>
			</div>
		{/snippet}
	</Toolbar>
	<SubToolbar>
		<div class="flex items-center gap-1">
			<SubToolbarLink
				href="/settings/integrations"
				label={m['integrations:title']()}
				icon={Link2}
				active={currentPath.includes('/integrations')}
			/>
			{#if isPlatformAdmin}
				<SubToolbarLink
					href="/settings/legal"
					label={m['settings:nav_legal']()}
					icon={ScrollText}
					active={currentPath.includes('/legal')}
				/>
			{/if}
		</div>
	</SubToolbar>

	<main class="flex flex-1 flex-col overflow-y-auto">
		{@render children()}
	</main>
</div>
