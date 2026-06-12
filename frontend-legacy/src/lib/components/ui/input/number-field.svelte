<script lang="ts">
	import Input from './input.svelte'
	import Label from '../label/label.svelte'

	let {
		id,
		label,
		suffix,
		value = $bindable(),
		min = 0,
		max,
		step = 1,
		class: className = ''
	}: {
		id: string
		label: string
		suffix: string
		value: number
		min?: number
		max?: number
		step?: number
		class?: string
	} = $props()
</script>

<div class={className}>
	<Label for={id} class="mb-1 block text-xs font-medium text-slate-500">{label}</Label>
	<div class="relative">
		<Input {id} type="number" {min} {max} {step} bind:value class="pr-8" />
		<span
			class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-400"
			>{suffix}</span
		>
	</div>
</div>
