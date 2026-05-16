<script lang="ts">
	import { X, Send, Square, Trash2, MessageSquare } from 'lucide-svelte'
	import type { CampaignChatStore } from '$lib/stores/campaign-chat.svelte'

	let {
		chat,
		systemPrompt,
		tenantId,
		campaignId
	}: {
		chat: CampaignChatStore
		systemPrompt: string
		tenantId: string
		campaignId: string
	} = $props()

	let input = $state('')
	let viewport: HTMLDivElement | null = $state(null)

	$effect(() => {
		// Scroll to bottom whenever messages change
		if (chat.messages.length && viewport) {
			viewport.scrollTop = viewport.scrollHeight
		}
	})

	function send() {
		const text = input.trim()
		if (!text || chat.busy) return
		input = ''
		chat.send({ tenant_id: tenantId, campaign_id: campaignId, system: systemPrompt }, text)
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			send()
		}
	}

	function renderMd(md: string): string {
		return md
			.replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold mt-3 mb-1">$1</h3>')
			.replace(/^## (.+)$/gm, '<h3 class="text-sm font-bold mt-3 mb-1">$1</h3>')
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/^- (.+)$/gm, '<li class="ml-3 list-disc">$1</li>')
			.replace(/\n\n/g, '<br class="mb-1">')
	}
</script>

<!-- Floating button -->
{#if !chat.isOpen}
	<button
		onclick={() => chat.open()}
		class="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl"
		aria-label="Open AI chat"
	>
		<MessageSquare class="h-6 w-6" />
		{#if chat.messages.length > 0}
			<span
				class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold"
			>
				{chat.messages.filter((m) => m.role === 'assistant').length}
			</span>
		{/if}
	</button>
{/if}

<!-- Chat panel -->
{#if chat.isOpen}
	<div
		class="fixed right-6 bottom-6 z-50 flex w-[420px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
		style="height: min(600px, calc(100vh - 6rem))"
	>
		<!-- Header -->
		<div
			class="flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50"
		>
			<div class="flex items-center gap-2">
				<div
					class="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40"
				>
					<svg
						class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
						/>
					</svg>
				</div>
				<span class="text-sm font-semibold text-slate-700 dark:text-slate-200"
					>AI Campaign Chat</span
				>
			</div>
			<div class="flex items-center gap-1">
				{#if chat.messages.length > 0}
					<button
						onclick={() => chat.clear()}
						class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
						title="Clear conversation"
					>
						<Trash2 class="h-3.5 w-3.5" />
					</button>
				{/if}
				<button
					onclick={() => chat.close()}
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
				>
					<X class="h-4 w-4" />
				</button>
			</div>
		</div>

		<!-- Messages -->
		<div bind:this={viewport} class="flex-1 space-y-3 overflow-y-auto p-4">
			{#if chat.messages.length === 0}
				<div
					class="flex h-full flex-col items-center justify-center text-center text-slate-400 dark:text-slate-600"
				>
					<MessageSquare class="mb-2 h-8 w-8" />
					<p class="text-sm">Ask anything about this campaign.</p>
					<p class="mt-1 text-xs">Campaign data is pre-loaded as context.</p>
				</div>
			{:else}
				{#each chat.messages as msg (msg)}
					<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div
							class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm
							{msg.role === 'user'
								? 'rounded-br-sm bg-indigo-600 text-white'
								: 'rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'}"
						>
							{#if msg.role === 'assistant'}
								{#if msg.streaming && !msg.content}
									<div class="flex items-center gap-1 py-0.5">
										<span
											class="h-2 w-2 animate-bounce rounded-full bg-slate-400"
											style="animation-delay:0ms"
										></span>
										<span
											class="h-2 w-2 animate-bounce rounded-full bg-slate-400"
											style="animation-delay:150ms"
										></span>
										<span
											class="h-2 w-2 animate-bounce rounded-full bg-slate-400"
											style="animation-delay:300ms"
										></span>
									</div>
								{:else}
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html renderMd(msg.content)}
									{#if msg.streaming}
										<span
											class="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-indigo-500 align-text-bottom"
										></span>
									{/if}
								{/if}
							{:else}
								{msg.content}
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Input -->
		<div class="border-t border-slate-100 p-3 dark:border-slate-800">
			<div class="flex items-end gap-2">
				<textarea
					bind:value={input}
					onkeydown={onKeydown}
					placeholder="Ask about keywords, budget, CPA…"
					rows={1}
					disabled={chat.busy}
					class="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
					style="max-height: 120px; overflow-y: auto; field-sizing: content"
				></textarea>
				{#if chat.busy}
					<button
						onclick={() => chat.abort()}
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
						title="Stop generation"
					>
						<Square class="h-4 w-4" />
					</button>
				{:else}
					<button
						onclick={send}
						disabled={!input.trim()}
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
					>
						<Send class="h-4 w-4" />
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
