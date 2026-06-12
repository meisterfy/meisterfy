<script lang="ts">
	import { Tabs } from 'bits-ui'
	import type { Snippet } from 'svelte'

	let { value, children } = $props<{
		value: string
		children: Snippet
	}>()
</script>

<Tabs.Trigger
	{value}
	class="hover:not:data-[state=active]:underline rounded-md border border-white/5 px-4 py-2 
    text-sm font-bold transition-all duration-200 
    data-[state=active]:border-white/10 data-[state=active]:bg-white/5"
>
	{@render children()}
</Tabs.Trigger>
