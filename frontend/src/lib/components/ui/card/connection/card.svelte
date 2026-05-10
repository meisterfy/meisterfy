<script lang="ts">
	import type { Snippet } from 'svelte'

	let { children, footer, variant = 'default' } = $props<{
		children: Snippet
        footer?: Snippet
        variant?: 'default' | 'border'
	}>()

	const classes = $derived(variant === 'border' ? 
        'border border-slate-500/20 group hover:border-blue-500/50 hover:shadow-blue-500/10 hover:shadow-lg' : 
        'bg-slate-900 border border-white/5 hover:shadow-lg hover:shadow-black/25'
    )
</script>

<div class="flex flex-col gap-2 rounded-lg h-full transition-all duration-300 {classes}">
    {@render children()}

    {#if footer}
        <div class="flex flex-row gap-2 mt-auto items-center justify-end border-t border-slate-500/20 p-4 group-hover:border-blue-500/40 transition-all duration-500">
            {@render footer()}
        </div>
    {/if}
</div>