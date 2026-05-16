<script lang="ts">
	import type { ProviderSchema } from '$lib/api/integrations'
	import ProviderIcon from '$lib/components/ui/provider-icon.svelte'
	import { LucideBook } from 'lucide-svelte'
	import Card from '$lib/components/ui/card/connection/card.svelte'
	import FooterBtn from '$lib/components/ui/card/connection/card-footer-btn.svelte'

	let { provider, onclick } = $props<{
		provider: ProviderSchema
		onclick: () => void
	}>()
</script>

<Card variant="border">
	<div class="flex flex-row items-start justify-start gap-2 p-4">
		<div
			class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-500/15 bg-slate-500/10 p-2"
		>
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
		<div class="mr-auto text-[10px] font-bold text-slate-200 uppercase">
			#{provider.group.replace('_', '-')}
		</div>
		<FooterBtn href="#" variant="ghost" label="Read docs" icon={LucideBook} />
		<FooterBtn {onclick} variant="primary" label="Add Connection" />
	{/snippet}
</Card>
