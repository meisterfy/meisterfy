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
	<div {style} class="object-contain [&>svg]:h-full [&>svg]:w-full [&>svg]:object-contain {className}">
		{@html logoSvg}
	</div>
{:else if logoPng}
	<img
		src={logoPng.startsWith('data:') ? logoPng : `data:image/png;base64,${logoPng}`}
		alt={provider}
		{style}
		class="object-contain {className}"
	/>
{/if}

