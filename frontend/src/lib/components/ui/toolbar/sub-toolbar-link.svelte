<script lang="ts">

	import type { Component } from 'svelte'
    import type { IconProps } from 'lucide-svelte'

	interface Props {
		href: string
		label: string
		icon: Component<IconProps>
		active: boolean
	}

	let { href, label, icon: Icon, active }: Props = $props()
</script>

<a
	{href}
	class="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors {active
		? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
		: 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}"
>
	<Icon class="h-4 w-4" />
	{label}
</a>