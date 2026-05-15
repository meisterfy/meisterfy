<script lang="ts">
	let { name, size = 'md' } = $props<{ name: string; size?: 'sm' | 'md' }>()

	const initials = $derived(
		name
			.split(' ')
			.slice(0, 2)
			.map((w: string) => w[0])
			.join('')
			.toUpperCase()
	)
</script>

<div
	class="flex shrink-0 items-center justify-center rounded-lg bg-indigo-100 font-bold text-indigo-600 shadow-sm dark:bg-indigo-900/50 dark:text-indigo-400
    {size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-sm'}"
>
	{initials}
</div>
