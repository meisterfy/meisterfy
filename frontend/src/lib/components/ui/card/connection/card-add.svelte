<script lang="ts">
	import type { ProviderSchema } from '$lib/api/integrations'
	import ProviderIcon from '$lib/components/ui/provider-icon.svelte'
	import { LucideBook } from 'lucide-svelte'
    import type { Component } from 'svelte'
    import Card from '$lib/components/ui/card/connection/card.svelte'
    import FooterBtn from '$lib/components/ui/card/connection/card-footer-btn.svelte'

	let { provider, onclick } = $props<{
		provider: ProviderSchema
		onclick: () => void
	}>()
</script>

<Card variant="border">
    <div class="flex flex-row gap-2 items-start justify-start p-4">
        <div class="w-16 h-16 p-2 shrink-0 bg-slate-500/10 border border-slate-500/15 rounded-lg flex items-center justify-center">
            <ProviderIcon 
                provider={provider.provider} 
                logoSvg={provider.logo_svg}
                logoPng={provider.logo_png}
            />
        </div>
        <div class="flex flex-col">
            <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">
                {provider.display_name}
            </h3>
            <p class="text-xs text-slate-400">
                {provider.description}
            </p>
        </div>
    </div>
    {#snippet footer()}
        <div class="text-[10px] text-slate-200 font-bold mr-auto uppercase">
            #{provider.group.replace('_', '-')}
        </div>
        <FooterBtn
            href="#"
            variant="ghost"
            label="Read docs"
            icon={LucideBook}
        />
        <FooterBtn
            onclick={onclick}
            variant="primary"
            label="Add Connection"
        />
    {/snippet}
</Card>
