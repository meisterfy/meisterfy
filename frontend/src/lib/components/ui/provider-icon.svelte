<script lang="ts">
	let {
		provider,
		logoSvg = '',
		logoPng = '',
		class: className = ''
	} = $props<{
		provider: string
		logoSvg?: string
		logoPng?: string
		class?: string
	}>()
</script>

{#if logoSvg}
	<div class="object-contain [&>svg]:h-full [&>svg]:w-full [&>svg]:object-contain {className}">
		{@html logoSvg}
	</div>
{:else if logoPng}
	<img 
		src={logoPng.startsWith('data:') ? logoPng : `data:image/png;base64,${logoPng}`} 
		alt={provider} 
		class="object-contain {className}"
	/>
{/if}

