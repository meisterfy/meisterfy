<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements'
	import { Eye, EyeOff } from 'lucide-svelte'
	import { cn } from '$lib/utils'

	let {
		class: className,
		value = $bindable(),
		type = 'text',
		...restProps
	}: HTMLInputAttributes = $props()

	let showPassword = $state(false)
</script>

{#if type === 'password'}
	<div class="relative w-full">
		<input
			bind:value
			type={showPassword ? 'text' : 'password'}
			class={cn(
				'flex w-full rounded-lg border border-slate-200 bg-white px-2 py-1.75 pr-9 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-indigo-500',
				className
			)}
			{...restProps}
		/>
		<button
			type="button"
			tabindex="-1"
			class="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none dark:hover:text-slate-300"
			onclick={() => (showPassword = !showPassword)}
		>
			{#if showPassword}
				<EyeOff class="h-4 w-4" />
			{:else}
				<Eye class="h-4 w-4" />
			{/if}
		</button>
	</div>
{:else}
	<input
		bind:value
		{type}
		class={cn(
			'flex w-full rounded-lg border border-slate-200 bg-white px-2 py-1.75 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-indigo-500',
			className
		)}
		{...restProps}
	/>
{/if}
