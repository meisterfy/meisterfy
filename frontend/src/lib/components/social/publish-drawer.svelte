<script lang="ts">
	import { X, Send, AlertCircle } from 'lucide-svelte'
	import type { PostShape } from '$lib/social'
	import Drawer from '$lib/components/ui/drawer/drawer.svelte'
	import { publishToMeta, type ConnectorResource } from '$lib/api/connector-resources'
	import { inputCls, labelCls } from './styles'

	let {
		open = $bindable(false),
		draft = null,
		tenant,
		metaAccounts,
		onPublished
	}: {
		open: boolean
		draft: PostShape | null
		tenant: string
		metaAccounts: ConnectorResource[]
		onPublished: (id: string) => void
	} = $props()

	let publishAccountId = $state('')
	let publishPlatform = $state<'instagram' | 'facebook'>('instagram')
	let isPublishing = $state(false)
	let publishError = $state<string | null>(null)

	$effect(() => {
		if (open && draft) {
			publishAccountId = metaAccounts[0]?.id ?? ''
			publishPlatform = 'instagram'
			publishError = null
		}
	})

	async function doPublish() {
		if (!draft || !publishAccountId) return
		isPublishing = true
		publishError = null
		try {
			await publishToMeta(tenant, {
				post_id: draft.id,
				account_id: publishAccountId,
				platform: publishPlatform
			})
			onPublished(draft.id)
			open = false
		} catch (err) {
			publishError = err instanceof Error ? err.message : 'Publish failed'
		} finally {
			isPublishing = false
		}
	}
</script>

<Drawer bind:open>
	<div class="flex h-full flex-col">
		{#if draft}
			<div
				class="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800"
			>
				<div class="min-w-0 flex-1 pr-4">
					<h2 class="text-lg font-bold text-slate-900 dark:text-white">Publish to Meta</h2>
					<p class="truncate text-sm text-slate-500">{draft.title}</p>
				</div>
				<button
					onclick={() => (open = false)}
					class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
				>
					<X class="h-5 w-5" />
				</button>
			</div>
			<div class="flex-1 overflow-y-auto px-6 py-5">
				<div class="flex flex-col gap-4">
					{#if metaAccounts.length === 0}
						<div
							class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20"
						>
							<div class="flex items-start gap-2">
								<AlertCircle class="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
								<div>
									<p class="text-sm font-medium text-amber-800 dark:text-amber-200">
										No Meta accounts found
									</p>
									<p class="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
										Connect a Meta integration in Settings → Integrations and authorize it to
										discover pages.
									</p>
								</div>
							</div>
						</div>
					{:else}
						<div>
							<p class={labelCls}>Account</p>
							<select bind:value={publishAccountId} class={inputCls}>
								{#each metaAccounts as acc (acc.id)}
									{@const igUsername = (acc.metadata?.ig_username as string | undefined) ?? ''}
									<option value={acc.id}>
										{acc.resource_name ?? acc.resource_id}
										{#if igUsername}
											(IG: {igUsername})
										{/if}
									</option>
								{/each}
							</select>
						</div>
						<div>
							<p class={labelCls}>Platform</p>
							<div class="flex gap-2">
								<button
									onclick={() => (publishPlatform = 'instagram')}
									class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {publishPlatform ===
									'instagram'
										? 'border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-900/20 dark:text-pink-400'
										: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}"
								>
									Instagram
								</button>
								<button
									onclick={() => (publishPlatform = 'facebook')}
									class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {publishPlatform ===
									'facebook'
										? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
										: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}"
								>
									Facebook
								</button>
							</div>
						</div>
						{#if publishError}
							<div
								class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
							>
								{publishError}
							</div>
						{/if}
					{/if}
				</div>
			</div>
			<div class="flex shrink-0 gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
				<button
					onclick={doPublish}
					disabled={!publishAccountId || isPublishing || metaAccounts.length === 0}
					class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
				>
					<Send class="h-4 w-4" />
					{isPublishing ? 'Publishing…' : 'Publish Now'}
				</button>
				<button
					onclick={() => (open = false)}
					class="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
				>
					Cancel
				</button>
			</div>
		{/if}
	</div>
</Drawer>
