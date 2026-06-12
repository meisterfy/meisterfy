<script lang="ts">
	import { User, Settings, LogOut, Languages, Palette } from 'lucide-svelte'
	import Dropdown from '$lib/components/ui/dropdown/dropdown.svelte'
	import { localeStore, LOCALE_OPTIONS } from '$lib/stores/locale.svelte'
	import { THEME_OPTIONS } from '$lib/stores/theme.svelte'
	import { m } from '$lib/paraglide/messages'
	import { setMode, mode } from 'mode-watcher'
	import type { MenuItem } from '$lib/types/menu'

	const profileItems = $derived<MenuItem[]>([
		{ label: 'Profile', href: '/profile', icon: User },
		{ label: 'Settings', href: '/settings', icon: Settings },
		{
			label: m['settings:language_title'](),
			icon: Languages,
			children: LOCALE_OPTIONS.map((opt) => ({
				label: opt.label,
				flag: opt.flag,
				onclick: () => localeStore.switchTo(opt.value),
				active: localeStore.current === opt.value
			}))
		},
		{
			label: m['settings:theme_title'](),
			icon: Palette,
			children: THEME_OPTIONS.map((opt) => ({
				label: m[opt.labelKey](),
				icon: opt.icon,
				onclick: () => setMode(opt.value),
				active: mode.current === opt.value
			}))
		},
		{ type: 'separator' },
		{ label: 'Logout', href: '/logout', icon: LogOut, variant: 'danger' }
	])
</script>

<Dropdown items={profileItems} align="end">
	<div
		class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5
		text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900
		dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
	>
		<User class="h-4 w-4" />
	</div>
</Dropdown>
