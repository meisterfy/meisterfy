<script lang="ts">
	import { resolve } from '$app/paths'

	interface Props {
		href: string
		label: string
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon: any
		active: boolean
	}

	let { href, label, icon: Icon, active }: Props = $props()
</script>

<a
	href={resolve(href)}
	class="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors {active
		? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
		: 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}"
>
	<Icon class="h-4 w-4" />
	{label}
</a>
