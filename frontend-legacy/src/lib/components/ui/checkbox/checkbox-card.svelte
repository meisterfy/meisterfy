<script lang="ts">
	let {
		checked = $bindable(false),
		title,
		description,
		class: className = ''
	}: {
		checked: boolean
		title: string
		description: string
		class?: string
	} = $props()
</script>

<label class="flex cursor-pointer items-start gap-3 {className}">
	<input
		type="checkbox"
		bind:checked
		class="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
	/>
	<div>
		<p class="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
		<p class="text-xs text-slate-500 dark:text-slate-400">{description}</p>
	</div>
</label>
