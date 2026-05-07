<script lang="ts">
	import { page } from '$app/state'
	import { CalendarDays, File } from 'lucide-svelte'
	import type { Snippet } from 'svelte'
	import SubToolbar from '$lib/components/ui/toolbar/sub-toolbar.svelte'
	import SubToolbarLink from '$lib/components/ui/toolbar/sub-toolbar-link.svelte'

	let { children } = $props<{ children: Snippet }>()
	let currentPath = $derived(page.url.pathname)
	let isDrafts = $derived(currentPath.includes('/drafts'))

	const navItems = $derived([
		{
			href: page.params.tenant ? `/${page.params.tenant}/social` : '/social',
			label: 'Planner',
			icon: CalendarDays,
			active: !isDrafts
		},
		{
			href: page.params.tenant ? `/${page.params.tenant}/social/drafts` : '/social/drafts',
			label: 'Drafts',
			icon: File,
			active: isDrafts
		}
	])
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<SubToolbar>
		<div class="flex items-center gap-1">
			{#each navItems as item}
				<SubToolbarLink
					href={item.href}
					label={item.label}
					icon={item.icon}
					active={item.active}
				/>
			{/each}
		</div>
	</SubToolbar>

	{@render children()}
</div>
