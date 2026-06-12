<script lang="ts">
	import type { PostStatus } from '$lib/api/posts'

	const { status }: { status: PostStatus | string } = $props()

	const colorMap: Record<string, string> = {
		draft: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
		approved: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
		scheduled: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
		published: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
	}

	const classes = $derived(colorMap[status] ?? colorMap.draft)
</script>

<span class="rounded-full px-2 py-0.5 text-xs font-bold tracking-wide uppercase {classes}"
	>{status}</span
>
