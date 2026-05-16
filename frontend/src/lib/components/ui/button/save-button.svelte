<script lang="ts">
	import Button from './button.svelte'
	import { CircleCheck } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'
	import type { HTMLButtonAttributes } from 'svelte/elements'

	let {
		isSaving,
		saved,
		text = m['settings:save'](),
		savingText = m['settings:saving'](),
		savedText = m['settings:saved'](),
		class: className = '',
		...restProps
	}: HTMLButtonAttributes & {
		isSaving: boolean
		saved: boolean
		text?: string
		savingText?: string
		savedText?: string
		class?: string
	} = $props()
</script>

<div class="flex items-center gap-3 {className}">
	<Button type="button" disabled={isSaving} {...restProps}>
		{isSaving ? savingText : text}
	</Button>
	{#if saved}
		<span class="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
			<CircleCheck class="h-4 w-4" />
			{savedText}
		</span>
	{/if}
</div>
