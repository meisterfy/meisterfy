<script lang="ts">
	let { title, subtitle }: { title: string; subtitle?: string } = $props()
</script>

<div class="flex flex-col gap-1">
    <p class="text-sm lg:text-lg xl:text-xl font-medium text-text">
        {title}
    </p>
    {#if subtitle}
        <p class="text-xs lg:text-md text-primary/70">
            {subtitle}
        </p>
    {/if}
</div>