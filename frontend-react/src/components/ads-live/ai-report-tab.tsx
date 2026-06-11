import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Copy,
  RotateCcw,
  ChevronDown,
  Square,
} from 'lucide-react'
import { marked } from 'marked'
import { toast } from 'sonner'
import { streamGenerate, getAIProviders, type AIProvider } from '@/lib/api/ai'
import { listAIReports, saveAIReport, type AIReport } from '@/lib/api/ai-reports'
import type {
  LiveCampaignDetail,
  SearchTermRow,
  KeywordPerfRow,
  KeywordQSRow,
} from '@/lib/api/campaigns'
import { buildCampaignData, buildChatSystemPrompt, type BrandContext } from '@/lib/ai/campaign-context'

const PROVIDER_LABELS: Record<string, string> = {
  claude: 'Claude',
  openai: 'ChatGPT',
  gemini: 'Gemini',
  groq: 'Groq',
  kimi: 'Kimi',
}

function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface AiReportTabProps {
  tenant: string
  campaignId: string
  brand: BrandContext
  detail: LiveCampaignDetail | null
  searchTerms: SearchTermRow[]
  keywords: KeywordPerfRow[]
  qualityScores: KeywordQSRow[]
}

export function AiReportTab({
  tenant,
  campaignId,
  brand,
  detail,
  searchTerms,
  keywords,
  qualityScores,
}: AiReportTabProps) {
  const { t } = useTranslation('ads')
  const [report, setReport] = useState('')
  const [history, setHistory] = useState<AIReport[]>([])
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [availableProviders, setAvailableProviders] = useState<AIProvider[]>([])
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)
  const controllerRef = useRef<AbortController | null>(null)

  const lastSaved = history[0] ?? null

  useEffect(() => {
    let active = true
    async function load() {
      const [providers, reports] = await Promise.allSettled([
        getAIProviders(tenant),
        listAIReports(tenant, campaignId, 'instant', 10),
      ])
      if (!active) return
      if (providers.status === 'fulfilled') {
        setAvailableProviders(providers.value)
        setSelectedProvider(providers.value[0]?.name ?? null)
      }
      if (reports.status === 'fulfilled' && reports.value.length > 0) {
        setHistory(reports.value)
        setSelectedHistoryId(reports.value[0].id)
        setReport(reports.value[0].content)
      }
      setIsLoadingProviders(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [tenant, campaignId])

  async function generate() {
    if (!selectedProvider) return
    if (!detail) {
      toast.error(t('analytics.ai_no_campaign_data'))
      return
    }

    setIsGenerating(true)
    let acc = ''
    setReport('')
    const controller = new AbortController()
    controllerRef.current = controller

    const campaignData = buildCampaignData(detail, searchTerms, keywords, qualityScores)
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
        (chunk) => {
          if (!chunk.done) {
            acc += chunk.content
            setReport(acc)
          }
        },
        controller.signal,
      )

      if (acc) {
        const saved = await saveAIReport(tenant, campaignId, {
          content: acc,
          report_type: 'instant',
          model: selectedProvider,
        })
        setHistory((prev) => [saved, ...prev])
        setSelectedHistoryId(saved.id)
      }
    } catch (e: unknown) {
      if ((e as Error)?.name !== 'AbortError') {
        toast.error(e instanceof Error ? e.message : 'Generation failed')
      }
    } finally {
      setIsGenerating(false)
      controllerRef.current = null
    }
  }

  function abort() {
    controllerRef.current?.abort()
    controllerRef.current = null
    setIsGenerating(false)
  }

  async function copyReport() {
    if (!report) return
    await navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function formatMeta(r: AIReport): string {
    const who = r.generated_by_name ?? r.model ?? 'AI'
    return `${who} · ${formatDate(r.generated_at)}`
  }

  return (
    <div className="space-y-4 py-6">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isLoadingProviders ? (
            <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ) : availableProviders.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {t('analytics.ai_no_provider')}
            </div>
          ) : availableProviders.length > 1 ? (
            <div className="relative">
              <select
                value={selectedProvider ?? ''}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {availableProviders.map((p) => (
                  <option key={p.name} value={p.name}>
                    {PROVIDER_LABELS[p.name] ?? p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {PROVIDER_LABELS[availableProviders[0].name] ?? availableProviders[0].name}
            </span>
          )}

          {isGenerating ? (
            <button
              onClick={abort}
              className="flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
            >
              <Square className="h-4 w-4" />
              {t('analytics.ai_stop')}
            </button>
          ) : (
            <button
              onClick={generate}
              disabled={availableProviders.length === 0}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {report ? (
                <>
                  <RotateCcw className="h-4 w-4" />
                  {t('analytics.ai_regenerate')}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t('analytics.ai_generate')}
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {lastSaved && !isGenerating && (
            <span className="text-xs text-slate-400 dark:text-slate-500">{formatMeta(lastSaved)}</span>
          )}
          {report && (
            <button
              onClick={copyReport}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? t('analytics.ai_copied') : t('analytics.ai_copy')}
            </button>
          )}
        </div>
      </div>

      {/* Generating indicator */}
      {isGenerating && !report && (
        <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-600 dark:border-indigo-900/30 dark:bg-indigo-900/10 dark:text-indigo-400">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          {t('analytics.ai_analyzing')}
        </div>
      )}

      {/* History tabs (when more than one report exists) */}
      {history.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {history.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setSelectedHistoryId(r.id)
                setReport(r.content)
              }}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedHistoryId === r.id
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {formatDate(r.generated_at)}
              {r.model ? ` · ${r.model}` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Report output */}
      {report ? (
        <div className="prose prose-slate dark:prose-invert max-w-none rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }} />
          {isGenerating && (
            <span className="inline-block h-4 w-0.5 animate-pulse bg-indigo-500 align-text-bottom" />
          )}
        </div>
      ) : (
        !isGenerating &&
        availableProviders.length > 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
            <Sparkles className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="mb-1 text-sm font-medium text-slate-600 dark:text-slate-400">
              {t('analytics.ai_title')}
            </p>
            <p className="text-xs text-slate-400">{t('analytics.ai_description')}</p>
          </div>
        )
      )}
    </div>
  )
}
