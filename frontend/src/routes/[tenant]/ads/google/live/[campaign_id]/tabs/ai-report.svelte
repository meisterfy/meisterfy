<script lang="ts">
	import { onMount } from 'svelte'
	import { Sparkles, Loader2, AlertCircle, Copy, RotateCcw, ChevronDown, Square } from 'lucide-svelte'
	import { streamGenerate, getAIProviders, type AIProvider } from '$lib/api/ai'
	import { listAIReports, saveAIReport, type AIReport } from '$lib/api/ai-reports'
	import { toast } from 'svelte-sonner'
	import type { LiveCampaignDetail, SearchTermRow, KeywordPerfRow, KeywordQSRow } from '$lib/api/campaigns'
	import type { ReportPrompts } from '$lib/api/tenants'
	import { buildCampaignData, buildChatSystemPrompt } from '$lib/ai/campaign-context'

	interface Brand {
		name: string
		niche: string | null
		location: string | null
		primary_persona: string | null
		tone: string | null
		instructions: string | null
		report_prompts: ReportPrompts | null
	}

	let {
		tenant,
		campaignId,
		brand,
		detail,
		searchTerms,
		keywords,
		qualityScores,
	}: {
		tenant: string
		campaignId: string
		brand: Brand
		detail: Promise<LiveCampaignDetail | null>
		searchTerms: Promise<SearchTermRow[]>
		keywords: Promise<KeywordPerfRow[]>
		qualityScores: Promise<KeywordQSRow[]>
	} = $props()

	let report        = $state('')
	let lastSaved     = $state<AIReport | null>(null)
	let isGenerating  = $state(false)
	let copied        = $state(false)
	let selectedProvider = $state<string | null>(null)
	let availableProviders = $state<AIProvider[]>([])
	let isLoadingProviders = $state(true)
	let controller: AbortController | null = null

	const PROVIDER_LABELS: Record<string, string> = {
		claude: 'Claude', openai: 'ChatGPT', gemini: 'Gemini', groq: 'Groq', kimi: 'Kimi',
	}

	onMount(async () => {
		const [providers, reports] = await Promise.allSettled([
			getAIProviders(tenant),
			listAIReports(tenant, campaignId, 'instant', 1),
		])

		if (providers.status === 'fulfilled') {
			availableProviders = providers.value
			selectedProvider = availableProviders[0]?.name ?? null
		}
		if (reports.status === 'fulfilled' && reports.value.length > 0) {
			lastSaved = reports.value[0]
			report = reports.value[0].content
		}
		isLoadingProviders = false
	})

	async function generate() {
		if (!selectedProvider) return
		const [d, terms, kw, qs] = await Promise.all([detail, searchTerms, keywords, qualityScores])
		if (!d) { toast.error('Campaign data not available.'); return }

		isGenerating = true
		report = ''
		controller = new AbortController()

		const campaignData = buildCampaignData(d, terms, kw, qs)
		const systemPrompt = buildChatSystemPrompt(brand, campaignData)

		try {
			await streamGenerate(
				{
					tenant_id: tenant,
					task_type: 'campaign_report',
					provider: selectedProvider,
					system: systemPrompt,
					messages: [{ role: 'user', content: campaignData }],
				},
				(chunk) => { if (!chunk.done) report += chunk.content },
				controller.signal
			)

			if (report) {
				lastSaved = await saveAIReport(tenant, campaignId, {
					content: report,
					report_type: 'instant',
					model: selectedProvider,
				})
			}
		} catch (e: unknown) {
			if ((e as Error)?.name !== 'AbortError') {
				toast.error(e instanceof Error ? e.message : 'Generation failed')
			}
		} finally {
			isGenerating = false
			controller = null
		}
	}

	function abort() {
		controller?.abort()
		controller = null
		isGenerating = false
	}

	async function copyReport() {
		if (!report) return
		await navigator.clipboard.writeText(report)
		copied = true
		setTimeout(() => (copied = false), 2000)
	}

	function formatMeta(r: AIReport): string {
		const date = new Date(r.generated_at).toLocaleString([], {
			day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
		})
		const who = r.generated_by_name ?? r.model ?? 'AI'
		return `${who} · ${date}`
	}

	function renderMarkdown(md: string): string {
		return md
			.replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-slate-900 dark:text-white mt-5 mb-2">$1</h3>')
			.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-slate-900 dark:text-white mt-6 mb-2">$1</h2>')
			.replace(/^# (.+)$/gm, '<h2 class="text-xl font-bold text-slate-900 dark:text-white mt-6 mb-2">$1</h2>')
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-slate-700 dark:text-slate-300">$1</li>')
			.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-slate-700 dark:text-slate-300">$1</li>')
			.replace(/\n\n/g, '<br class="mb-2">')
	}
</script>

<div class="space-y-4 py-6">
	<!-- Header bar -->
	<div class="flex items-center justify-between gap-4">
		<div class="flex items-center gap-3">
			{#if isLoadingProviders}
				<div class="h-9 w-40 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"></div>
			{:else if availableProviders.length === 0}
				<div class="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
					<AlertCircle class="h-4 w-4 shrink-0" />
					No AI provider connected for this client.
				</div>
			{:else if availableProviders.length > 1}
				<div class="relative">
					<select bind:value={selectedProvider}
						class="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
						{#each availableProviders as p (p.name)}
							<option value={p.name}>{PROVIDER_LABELS[p.name] ?? p.name}</option>
						{/each}
					</select>
					<ChevronDown class="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
				</div>
			{:else}
				<span class="text-sm text-slate-500 dark:text-slate-400">
					{PROVIDER_LABELS[availableProviders[0].name] ?? availableProviders[0].name}
				</span>
			{/if}

			{#if isGenerating}
				<button onclick={abort}
					class="flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400">
					<Square class="h-4 w-4" />
					Stop
				</button>
			{:else}
				<button onclick={generate} disabled={availableProviders.length === 0}
					class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
					{#if report}
						<RotateCcw class="h-4 w-4" />
						Regenerate
					{:else}
						<Sparkles class="h-4 w-4" />
						Generate Report
					{/if}
				</button>
			{/if}
		</div>

		<div class="flex items-center gap-3">
			{#if lastSaved && !isGenerating}
				<span class="text-xs text-slate-400 dark:text-slate-500">{formatMeta(lastSaved)}</span>
			{/if}
			{#if report}
				<button onclick={copyReport}
					class="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
					<Copy class="h-3.5 w-3.5" />
					{copied ? 'Copied!' : 'Copy'}
				</button>
			{/if}
		</div>
	</div>

	<!-- Generating indicator -->
	{#if isGenerating && !report}
		<div class="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-600 dark:border-indigo-900/30 dark:bg-indigo-900/10 dark:text-indigo-400">
			<Loader2 class="h-4 w-4 animate-spin shrink-0" />
			Analyzing campaign data… This may take up to a minute for deep analysis models.
		</div>
	{/if}

	<!-- Report output -->
	{#if report}
		<div class="rounded-xl border border-slate-200 bg-white p-6 text-sm leading-relaxed dark:border-slate-800 dark:bg-slate-900">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html renderMarkdown(report)}
			{#if isGenerating}
				<span class="inline-block h-4 w-0.5 animate-pulse bg-indigo-500 align-text-bottom"></span>
			{/if}
		</div>
	{:else if !isGenerating && availableProviders.length > 0}
		<div class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
			<Sparkles class="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
			<p class="mb-1 text-sm font-medium text-slate-600 dark:text-slate-400">AI Campaign Analysis</p>
			<p class="text-xs text-slate-400">Generate an AI-powered report based on this campaign's live data, keywords, and search terms.</p>
		</div>
	{/if}
</div>
