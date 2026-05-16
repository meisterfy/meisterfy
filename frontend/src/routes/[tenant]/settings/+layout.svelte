<script lang="ts">
	import { page, navigating } from '$app/state'
	import { Settings, BarChart2, Shield, Users, ShieldCheck } from 'lucide-svelte'
	import type { Snippet } from 'svelte'
	import SubToolbar from '$lib/components/ui/toolbar/sub-toolbar.svelte'
	import SubToolbarLink from '$lib/components/ui/toolbar/sub-toolbar-link.svelte'
	import { m } from '$lib/paraglide/messages'
	import { auth } from '$lib/stores/auth.svelte'
	import SettingsSkeleton from './settings-skeleton.svelte'

	let { children } = $props<{ children: Snippet }>()
	let currentPath = $derived(page.url.pathname)
	let canManageUsers = $derived(auth.user?.permissions?.includes('view-any:user') ?? false)

	const navItems = $derived([
		{
			href: `/${page.params.tenant}/settings/general`,
			label: m['settings:nav_general'](),
			icon: Settings,
			active: currentPath.includes('/settings/general'),
			show: true
		},
		{
			href: `/${page.params.tenant}/settings/google-ads`,
			label: m['settings:nav_google_ads'](),
			icon: BarChart2,
			active: currentPath.includes('/settings/google-ads'),
			show: true
		},
		{
			href: `/${page.params.tenant}/settings/audit`,
			label: m['settings:nav_audit'](),
			icon: Shield,
			active: currentPath.includes('/settings/audit'),
			show: true
		},
		{
			href: `/${page.params.tenant}/settings/users`,
			label: m['settings:nav_users'](),
			icon: Users,
			active: currentPath.includes('/settings/users'),
			show: canManageUsers
		},
		{
			href: `/${page.params.tenant}/settings/roles`,
			label: m['settings:nav_roles'](),
			icon: ShieldCheck,
			active: currentPath.includes('/settings/roles'),
			show: canManageUsers
		}
	])
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<SubToolbar>
		<div class="flex items-center gap-1">
			{#each navItems as item (item.label)}
				{#if item.show}
					<SubToolbarLink
						href={item.href}
						label={item.label}
						icon={item.icon}
						active={item.active}
					/>
				{/if}
			{/each}
		</div>
	</SubToolbar>

	{#if navigating.to?.url.pathname.includes('/settings/')}
		{@const dest = navigating.to?.url.pathname ?? ''}
		<SettingsSkeleton
			twoPanel={dest.includes('/roles')}
			rows={dest.includes('/audit') ? 8 : dest.includes('/users') ? 6 : 5}
		/>
	{:else}
		{@render children()}
	{/if}
</div>
