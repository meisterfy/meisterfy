<script lang="ts">
	import { page } from '$app/state'
	import {
		Share2,
		Target,
		Menu,
		X,
		ChevronDown,
		List,
		Plus,
		Settings
	} from 'lucide-svelte'
	import Toolbar from '$lib/components/ui/toolbar/toolbar.svelte'
	import ProfileLink from '$lib/components/ui/toolbar/link/profile.svelte'
	import BrandIcon from '$lib/components/ui/brand-icon.svelte'
	import Dropdown from '$lib/components/ui/dropdown/dropdown.svelte'
	import type { Snippet } from 'svelte'
	import type { LayoutData } from './$types'
	import type { MenuItem } from '$lib/types/menu'
	import * as m from '$lib/paraglide/messages.js'
	import Footer from '$lib/components/layout/footer.svelte'

	let { data, children } = $props<{ data: LayoutData; children: Snippet }>()

	let currentPath = $derived(page.url.pathname)
	let isMobileMenuOpen = $state(false)

	const navMain = $derived([
		{
			href: `/${page.params.tenant}/social`,
			label: 'Social',
			icon: Share2,
			active: currentPath.includes('/social')
		},
		{
			href: `/${page.params.tenant}/ads/google`,
			label: 'Google Ads',
			icon: Target,
			active: currentPath.includes('/ads/google')
		}
	])

	const clientMenuItems = $derived<MenuItem[]>([
		{ type: 'header', label: 'Switch Client' },
		{ type: 'separator' },
		...data.clients.map((t: any) => ({
			label: t.brand.name,
			href: `/${t.id}/social`,
			icon: BrandIcon,
			iconProps: { name: t.brand.name, size: 'sm' }
		})),
		{ type: 'separator' },
		{ label: 'Client Settings', href: `/${page.params.tenant}/settings`, icon: Settings },
		{ label: 'Create Client', href: '/tenants/new', icon: Plus, variant: 'indigo' },
		{ label: 'View all clients', href: '/', icon: List, variant: 'indigo' }
	])
</script>

<div class="flex min-h-screen w-full flex-col bg-slate-50 dark:bg-slate-950">
	<Toolbar>
		{#snippet header()}
			<Dropdown items={clientMenuItems} align="start">
				<div
					class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100 focus:outline-none dark:hover:bg-slate-800"
				>
					<BrandIcon name={data.client.brand.name} />
					<span class="text-base leading-tight font-bold text-slate-900 dark:text-white">
						{data.client.brand.name}
					</span>
					<ChevronDown class="h-3.5 w-3.5 text-slate-400" />
				</div>
			</Dropdown>

			<!-- Desktop Navigation -->
			<nav class="hidden items-center gap-1 md:flex">
				{#each navMain as item}
					{@const Icon = item.icon}
					<a
						href={item.href}
						class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {item.active
							? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
							: 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}"
					>
						<Icon class="h-4 w-4" />
						{item.label}
					</a>
				{/each}

				<ProfileLink />
			</nav>

			<!-- Mobile menu button -->
			<div class="flex items-center md:hidden">
				<button
					onclick={() => (isMobileMenuOpen = !isMobileMenuOpen)}
					class="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500 focus:outline-none dark:hover:bg-slate-800"
				>
					{#if isMobileMenuOpen}
						<X class="h-6 w-6" />
					{:else}
						<Menu class="h-6 w-6" />
					{/if}
				</button>
			</div>
		{/snippet}

		{#snippet mobileMenu()}
			{#if isMobileMenuOpen}
				<div
					class="border-t border-slate-200 bg-white px-2 pt-2 pb-3 md:hidden dark:border-slate-800 dark:bg-slate-900"
				>
					{#each navMain as item}
						{@const Icon = item.icon}
						<a
							href={item.href}
							onclick={() => (isMobileMenuOpen = false)}
							class="flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium {item.active
								? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
								: 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}"
						>
							<Icon class="h-5 w-5" />
							{item.label}
						</a>
					{/each}
					<a
						href="/{page.params.tenant}/settings"
						onclick={() => (isMobileMenuOpen = false)}
						class="flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium {currentPath.includes(
							'/settings'
						)
							? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
							: 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}"
					>
						<Settings class="h-5 w-5" />
						Settings
					</a>
				</div>
			{/if}
		{/snippet}
	</Toolbar>

	<main
		class="flex min-w-0 flex-1 flex-col print:h-auto print:flex-none print:overflow-visible"
	>
		{@render children()}
	</main>
	<Footer />
</div>

