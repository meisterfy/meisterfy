import { Sun, Moon, Monitor } from 'lucide-svelte'

export const THEME_OPTIONS = [
	{ value: 'light', labelKey: 'settings:theme_light', icon: Sun },
	{ value: 'dark', labelKey: 'settings:theme_dark', icon: Moon },
	{ value: 'system', labelKey: 'settings:theme_system', icon: Monitor }
] as const
