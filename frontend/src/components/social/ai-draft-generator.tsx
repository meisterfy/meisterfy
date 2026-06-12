import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, X, Loader2, AlertCircle, ChevronDown } from 'lucide-react'
import { Drawer } from '@/components/ui/drawer'
import { PlatformSelect } from '@/components/social/platform-select'
import { streamGenerate, getAIProviders, type AIProvider } from '@/lib/api/ai'
import { createPost } from '@/lib/api/posts'
import { normalizePost } from '@/lib/utils/transforms'
import type { PostShape, PostPlatform } from '@/lib/social'

const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500'

const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

const TONE_OPTIONS = [
  { value: 'engaging', label: 'Engaging' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'educational', label: 'Educational' },
]

const PROVIDER_LABELS: Record<string, string> = {
  claude: 'Claude (Anthropic)',
  openai: 'ChatGPT (OpenAI)',
  gemini: 'Gemini (Google)',
  groq: 'Groq',
  kimi: 'Kimi (Moonshot)',
}

interface AiDraftGeneratorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant: string
  onCreated: (posts: PostShape[]) => void
}

export function AiDraftGenerator({
  open,
  onOpenChange,
  tenant,
  onCreated,
}: AiDraftGeneratorProps) {
  const { t } = useTranslation('social-media')
  const [topic, setTopic] = useState('')
  const [platforms, setPlatforms] = useState<PostPlatform[]>(['instagram_feed'])
  const [count, setCount] = useState(3)
  const [tone, setTone] = useState('engaging')
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [availableProviders, setAvailableProviders] = useState<AIProvider[]>([])
  const [isLoadingProviders, setIsLoadingProviders] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')

  // Reset the form the moment the dialog opens (adjusting state during render —
  // see react.dev "You Might Not Need an Effect"); provider loading stays an effect.
  const [prevOpen, setPrevOpen] = useState<boolean | null>(null)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setTopic('')
      setPlatforms(['instagram_feed'])
      setCount(3)
      setTone('engaging')
      setError(null)
      setProgress('')
      setIsLoadingProviders(true)
    }
  }

  useEffect(() => {
    if (!open) return
    getAIProviders(tenant)
      .then((providers) => {
        setAvailableProviders(providers)
        setSelectedProvider(providers.length > 0 ? providers[0].name : null)
      })
      .catch(() => {
        setAvailableProviders([])
        setSelectedProvider(null)
      })
      .finally(() => {
        setIsLoadingProviders(false)
      })
  }, [open, tenant])

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
    setIsGenerating(true)
    setError(null)
    setProgress('Generating drafts…')

    let rawJson = ''

    try {
      await streamGenerate(
        {
          tenant_id: tenant,
          task_type: 'social_draft',
          provider: selectedProvider ?? undefined,
          system: buildSystemPrompt(),
          messages: [{ role: 'user', content: `Topic: ${topic.trim()}` }],
          max_tokens: 4096,
        },
        (chunk) => {
          if (!chunk.done) rawJson += chunk.content
        },
      )

      const jsonMatch = rawJson.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No valid JSON array found in response')

      const drafts: { title: string; content: string }[] = JSON.parse(jsonMatch[0])
      if (!Array.isArray(drafts) || drafts.length === 0) {
        throw new Error('Response contained no drafts')
      }

      setProgress(`Saving ${drafts.length} draft${drafts.length > 1 ? 's' : ''}…`)

      const created: PostShape[] = []
      for (const d of drafts) {
        const post = await createPost(tenant, {
          title: d.title?.trim() || 'AI Draft',
          content: d.content?.trim() || '',
          platforms: platforms as string[],
          status: 'draft',
        })
        created.push({ ...normalizePost(post), media_files: [] })
      }

      onCreated(created)
      onOpenChange(false)
    } catch (e) {
      let message = e instanceof Error ? e.message : 'Generation failed'
      if (message.includes('no connected llm') || message.includes('not connected')) {
        message =
          'No LLM connected. Go to Settings → Integrations and add a Claude, OpenAI, Gemini, Groq, or Kimi key, then assign it to this client.'
      }
      setError(message)
    } finally {
      setIsGenerating(false)
      setProgress('')
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={t('ai_generate_title')} headerless>
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('ai_generate_title')}
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-4">
            {/* Provider selector — only shown when multiple are available */}
            {isLoadingProviders ? (
              <div className="h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ) : availableProviders.length === 0 ? (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {t('ai_no_provider_pre')} <strong>{t('ai_no_provider_link')}</strong>{' '}
                  {t('ai_no_provider_post')}
                </p>
              </div>
            ) : availableProviders.length > 1 ? (
              <div>
                <label htmlFor="ai-provider" className={labelCls}>
                  {t('ai_provider_label')}
                </label>
                <div className="relative">
                  <select
                    id="ai-provider"
                    value={selectedProvider ?? ''}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className={`${inputCls} appearance-none pr-8`}
                  >
                    {availableProviders.map((p) => (
                      <option key={p.name} value={p.name}>
                        {PROVIDER_LABELS[p.name] ?? p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Using{' '}
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {PROVIDER_LABELS[availableProviders[0].name] ?? availableProviders[0].name}
                </span>
              </p>
            )}

            <div>
              <label htmlFor="ai-topic" className={labelCls}>
                {t('ai_topic_label')} <span className="text-red-400">*</span>
              </label>
              <textarea
                id="ai-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                placeholder={t('ai_topic_placeholder')}
                className={`${inputCls} resize-none`}
              />
            </div>

            <div>
              <p className={labelCls}>Platform</p>
              <PlatformSelect value={platforms} onChange={setPlatforms} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ai-count" className={labelCls}>
                  {t('ai_num_drafts_label')}
                </label>
                <select
                  id="ai-count"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className={inputCls}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ai-tone" className={labelCls}>
                  Tone
                </label>
                <select
                  id="ai-tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className={inputCls}
                >
                  {TONE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {isGenerating && progress && (
              <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2.5 text-sm text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                <p>{progress}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <button
            onClick={generate}
            disabled={!topic.trim() || isGenerating || availableProviders.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('ai_generating')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate {count} Draft{count > 1 ? 's' : ''}
              </>
            )}
          </button>
          <button
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </Drawer>
  )
}
