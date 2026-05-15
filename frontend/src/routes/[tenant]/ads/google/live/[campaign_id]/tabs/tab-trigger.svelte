<script lang="ts">
	import { Tabs } from 'bits-ui'

	let { value, children } = $props<{
		value: string
		children: any
	}>()
</script>

<Tabs.Trigger value={value} class="text-sm px-4 py-2 rounded-md font-bold transition-all 
    duration-200 border border-white/5 data-[state=active]:bg-white/5 
    data-[state=active]:border-white/10 hover:not:data-[state=active]:underline"
>
    {@render children()}
</Tabs.Trigger>