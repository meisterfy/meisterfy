<script lang="ts">
	import { m } from '$lib/paraglide/messages'
	import { Sparkles, X, Loader2, AlertCircle, ChevronDown } from 'lucide-svelte'
	import Drawer from '$lib/components/ui/drawer/drawer.svelte'
	import PlatformSelect from '$lib/components/ui/platform-select/platform-select.svelte'
	import { streamGenerate, getAIProviders, type AIProvider } from '$lib/api/ai'
	import { createPost } from '$lib/api/posts'
	import { normalizePost } from '$lib/utils/transforms'
	import type { PostShape, PostPlatform } from '$lib/social'
	import { inputCls, labelCls } from './styles'

	let {
		open = $bindable(false),
		tenant,
		onCreated
	}: {
		open: boolean
		tenant: string
		onCreated: (posts: PostShape[]) => void
	} = $props()

	let topic = $state('')
	let platforms = $state<PostPlatform[]>(['instagram_feed'])
	let count = $state(3)
	let tone = $state('engaging')
	let selectedProvider = $state<string | null>(null)
	let availableProviders = $state<AIProvider[]>([])
	let isLoadingProviders = $state(false)
	let isGenerating = $state(false)
	let error = $state<string | null>(null)
	let progress = $state('')

	const TONE_OPTIONS = [
		{ value: 'engaging', label: 'Engaging' },
		{ value: 'professional', label: 'Professional' },
		{ value: 'casual', label: 'Casual' },
		{ value: 'inspirational', label: 'Inspirational' },
		{ value: 'educational', label: 'Educational' }
	]

	const PROVIDER_LABELS: Record<string, string> = {
		claude: 'Claude (Anthropic)',
		openai: 'ChatGPT (OpenAI)',
		gemini: 'Gemini (Google)',
		groq: 'Groq',
		kimi: 'Kimi (Moonshot)'
	}

	$effect(() => {
		if (open) {
			topic = ''
			platforms = ['instagram_feed']
			count = 3
			tone = 'engaging'
			error = null
			progress = ''
			loadProviders()
		}
	})

	async function loadProviders() {
		isLoadingProviders = true
		try {
			availableProviders = await getAIProviders(tenant)
			selectedProvider = availableProviders.length > 0 ? availableProviders[0].name : null
		} catch {
			availableProviders = []
			selectedProvider = null
		} finally {
			isLoadingProviders = false
		}
	}

	function buildSystemPrompt(): string {
		return `You are an expert social media copywriter. Generate exactly ${count} distinct social media post drafts.

Rules:
- Tone: ${tone}
- Platforms: ${platforms.join(', ')}
- Each post must be self-contained and ready to publish
- Vary the angle, hook, and structure across posts
- Include relevant emojis where appropriate
- Do NOT include hashtags (they are handled separately)

Return ONLY a valid JSON array with this exact structure, no other text before or after:
[
  { "title": "Short post title (max 60 chars)", "content": "Post body text" },
  ...
]`
	}

	async function generate() {
		if (!topic.trim()) return
		isGenerating = true
		error = null
		progress = 'Generating drafts…'

		let rawJson = ''

		try {
			await streamGenerate(
				{
					tenant_id: tenant,
					task_type: 'social_draft',
					provider: selectedProvider ?? undefined,
					system: buildSystemPrompt(),
					messages: [{ role: 'user', content: `Topic: ${topic.trim()}` }],
					max_tokens: 4096
				},
				(chunk) => {
					if (!chunk.done) rawJson += chunk.content
				}
			)

			const jsonMatch = rawJson.match(/\[[\s\S]*\]/)
			if (!jsonMatch) throw new Error('No valid JSON array found in response')

			const drafts: { title: string; content: string }[] = JSON.parse(jsonMatch[0])
			if (!Array.isArray(drafts) || drafts.length === 0) {
				throw new Error('Response contained no drafts')
			}

			progress = `Saving ${drafts.length} draft${drafts.length > 1 ? 's' : ''}…`

			const created: PostShape[] = []
			for (const d of drafts) {
				const post = await createPost(tenant, {
					title: d.title?.trim() || 'AI Draft',
					content: d.content?.trim() || '',
					platforms: platforms as string[],
					status: 'draft'
				})
				created.push({ ...normalizePost(post), media_files: [] })
			}

			onCreated(created)
			open = false
		} catch (e) {
			error = e instanceof Error ? e.message : 'Generation failed'
			if (error.includes('no connected llm') || error.includes('not connected')) {
				error =
					'No LLM connected. Go to Settings → Integrations and add a Claude, OpenAI, Gemini, Groq, or Kimi key, then assign it to this client.'
			}
		} finally {
			isGenerating = false
			progress = ''
		}
	}
</script>

<Drawer bind:open>
	<div class="flex h-full flex-col">
		<div
			class="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800"
		>
			<div class="flex items-center gap-2">
				<Sparkles class="h-5 w-5 text-indigo-500" />
				<h2 class="text-lg font-bold text-slate-900 dark:text-white">
					{m['social-media:ai_generate_title']()}
				</h2>
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
				<!-- Provider selector — only shown when multiple are available -->
				{#if isLoadingProviders}
					<div class="h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"></div>
				{:else if availableProviders.length === 0}
					<div
						class="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
					>
						<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
						<p>
							{m['social-media:ai_no_provider_pre']()}
							<strong>{m['social-media:ai_no_provider_link']()}</strong>
							{m['social-media:ai_no_provider_post']()}
						</p>
					</div>
				{:else if availableProviders.length > 1}
					<div>
						<label for="ai-provider" class={labelCls}>{m['social-media:ai_provider_label']()}</label
						>
						<div class="relative">
							<select
								id="ai-provider"
								bind:value={selectedProvider}
								class="{inputCls} appearance-none pr-8"
							>
								{#each availableProviders as p (p.name)}
									<option value={p.name}>{PROVIDER_LABELS[p.name] ?? p.name}</option>
								{/each}
							</select>
							<ChevronDown
								class="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-400"
							/>
						</div>
					</div>
				{:else}
					<p class="text-xs text-slate-400">
						Using <span class="font-medium text-slate-600 dark:text-slate-300"
							>{PROVIDER_LABELS[availableProviders[0].name] ?? availableProviders[0].name}</span
						>
					</p>
				{/if}

				<div>
					<label for="ai-topic" class={labelCls}>
						{m['social-media:ai_topic_label']()} <span class="text-red-400">*</span>
					</label>
					<textarea
						id="ai-topic"
						bind:value={topic}
						rows="3"
						placeholder={m['social-media:ai_topic_placeholder']()}
						class="{inputCls} resize-none"
					></textarea>
				</div>

				<div>
					<p class={labelCls}>Platform</p>
					<PlatformSelect bind:value={platforms} />
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="ai-count" class={labelCls}>{m['social-media:ai_num_drafts_label']()}</label>
						<select id="ai-count" bind:value={count} class={inputCls}>
							{#each [1, 2, 3, 4, 5] as n (n)}
								<option value={n}>{n}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="ai-tone" class={labelCls}>Tone</label>
						<select id="ai-tone" bind:value={tone} class={inputCls}>
							{#each TONE_OPTIONS as t (t.value)}
								<option value={t.value}>{t.label}</option>
							{/each}
						</select>
					</div>
				</div>

				{#if error}
					<div
						class="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
					>
						<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
						<p>{error}</p>
					</div>
				{/if}

				{#if isGenerating && progress}
					<div
						class="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2.5 text-sm text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400"
					>
						<Loader2 class="h-4 w-4 shrink-0 animate-spin" />
						<p>{progress}</p>
					</div>
				{/if}
			</div>
		</div>

		<div class="flex shrink-0 gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
			<button
				onclick={generate}
				disabled={!topic.trim() || isGenerating || availableProviders.length === 0}
				class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
			>
				{#if isGenerating}
					<Loader2 class="h-4 w-4 animate-spin" />
					{m['social-media:ai_generating']()}
				{:else}
					<Sparkles class="h-4 w-4" />
					Generate {count} Draft{count > 1 ? 's' : ''}
				{/if}
			</button>
			<button
				onclick={() => (open = false)}
				disabled={isGenerating}
				class="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
			>
				Cancel
			</button>
		</div>
	</div>
</Drawer>
