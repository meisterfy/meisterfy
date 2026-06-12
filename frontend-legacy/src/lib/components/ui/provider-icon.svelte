<script lang="ts">
	let {
		provider,
		logoSvg = '',
		logoPng = '',
		class: className = '',
		style = ''
	} = $props<{
		provider: string
		logoSvg?: string
		logoPng?: string
		class?: string
		style?: string
	}>()
</script>

{#if logoSvg}
	<div
		{style}
		class="h-full w-full object-contain [&>svg]:h-full [&>svg]:w-full [&>svg]:object-contain {className}"
	>
		<!-- SVG from trusted source (admin-configured integration logos stored in DB, never user-provided) -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html logoSvg}
	</div>
{:else if logoPng}
	<img
		src={logoPng.startsWith('data:') ? logoPng : `data:image/png;base64,${logoPng}`}
		alt={provider}
		{style}
		class="h-full w-full object-contain {className}"
	/>
{/if}
