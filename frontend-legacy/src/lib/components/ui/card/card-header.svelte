<script lang="ts">
	let { title, subtitle }: { title: string; subtitle?: string } = $props()
</script>

<div class="flex flex-col gap-1">
	<p class="text-text text-sm font-medium lg:text-lg xl:text-xl">
		{title}
	</p>
	{#if subtitle}
		<p class="lg:text-md text-primary/70 text-xs">
			{subtitle}
		</p>
	{/if}
</div>
