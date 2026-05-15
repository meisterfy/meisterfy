<script lang="ts">
	import { localeStore, LOCALE_OPTIONS } from '$lib/stores/locale.svelte'
</script>

<select
	value={localeStore.current}
	onchange={(e) => localeStore.switchTo(e.currentTarget.value)}
	class="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition-colors hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
>
	{#each LOCALE_OPTIONS as opt}
		<option value={opt.value}>{opt.flag} {opt.label}</option>
	{/each}
</select>
