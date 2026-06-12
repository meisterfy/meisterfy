import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Save,
  FileEdit,
  Trash2,
  Sparkles,
  X,
  Send,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { PLATFORM_CONFIG } from '@/lib/social'
import {
  getPost,
  getPublishResults,
  updatePost,
  updatePostStatus,
  deletePost as apiDeletePost,
  type PostStatus,
  type PostPublishResult,
} from '@/lib/api/posts'
import { getTenant, type Tenant } from '@/lib/api/tenants'
import { normalizePost } from '@/lib/utils/transforms'
import { parseHashtags } from '@/lib/utils/hashtags'
import { streamGenerate } from '@/lib/api/ai'
import { uploadMedia } from '@/lib/api/media'
import type { PostShape } from '@/lib/social'
import { Route } from './$post_id'

const isVideo = (f: string) => /\.(mp4|webm)$/i.test(f)

export function PostEditorRoute() {
  const { tenant, post_id } = Route.useParams()
  const { t } = useTranslation('social-media')
  const navigate = useNavigate()

  const [post, setPost] = useState<PostShape | null>(null)
  const [brand, setBrand] = useState<Tenant | null>(null)
  const [publishResults, setPublishResults] = useState<PostPublishResult[]>([])

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [status, setStatus] = useState<PostStatus>('draft')
  const [mediaType, setMediaType] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)

  // AI panel state
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiStreaming, setAiStreaming] = useState(false)
  const [aiPreview, setAiPreview] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)

  const loadPost = useCallback(() => {
    return getPost(tenant, post_id).then((p) => {
      const normalized = normalizePost(p)
      setPost(normalized)
      setTitle(normalized.title)
      setContent(normalized.content)
      setHashtags(normalized.hashtags.join(' '))
      setStatus(normalized.status)
      setMediaType(normalized.media_type ?? null)
      return normalized
    })
  }, [tenant, post_id])

  useEffect(() => {
    let active = true
    Promise.all([
      loadPost().catch(() => null),
      getPublishResults(tenant, post_id).catch(() => []),
      getTenant(tenant).catch(() => null),
    ]).then(([, results, tenantData]) => {
      if (!active) return
      setPublishResults(results ?? [])
      setBrand(tenantData)
    })
    return () => {
      active = false
    }
  }, [tenant, post_id, loadPost])

  function buildSystemPrompt(): string {
    const b = brand
    if (!b) return 'You are a helpful social media copywriter.'
    const parts = ['You are a social media copywriter.']
    if (b.name) parts.push(`Brand: ${b.name}.`)
    if (b.niche) parts.push(`Niche: ${b.niche}.`)
    if (b.location) parts.push(`Location: ${b.location}.`)
    if (b.primary_persona) parts.push(`Target audience: ${b.primary_persona}.`)
    if (b.tone) parts.push(`Tone/voice: ${b.tone}.`)
    if (b.instructions) parts.push(`Guidelines: ${b.instructions}`)
    const lang =
      b.language === 'pt_BR'
        ? 'Brazilian Portuguese'
        : b.language === 'es_ES'
          ? 'Spanish'
          : 'English'
    parts.push(`Write in ${lang}.`)
    parts.push('Return only the post copy, no extra commentary.')
    return parts.join(' ')
  }

  async function generateContent() {
    if (!aiPrompt.trim() || aiStreaming) return
    setAiError(null)
    setAiPreview('')
    setAiStreaming(true)
    try {
      await streamGenerate(
        {
          tenant_id: tenant,
          system: buildSystemPrompt(),
          messages: [{ role: 'user', content: aiPrompt.trim() }],
          task_type: 'social_post',
          max_tokens: 800,
        },
        (chunk) => {
          setAiPreview((prev) => prev + chunk.content)
        },
      )
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setAiStreaming(false)
    }
  }

  function applyPreview() {
    setContent(aiPreview)
    setAiOpen(false)
    setAiPrompt('')
    setAiPreview('')
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!post || !files || files.length === 0) return
    setUploadingMedia(true)
    try {
      await uploadMedia(tenant, post.id, files)
      await loadPost()
    } catch {
      alert('Failed to upload media')
    } finally {
      setUploadingMedia(false)
    }
  }

  async function savePost() {
    if (!post) return
    setSaving(true)
    const tags = parseHashtags(hashtags)
    try {
      await updatePost(tenant, post.id, {
        title,
        content,
        hashtags: tags,
        media_type: mediaType,
      })
      if (status !== post.status) {
        await updatePostStatus(tenant, post.id, status)
      }
      navigate({ to: '/$tenant/social', params: { tenant } })
    } finally {
      setSaving(false)
    }
  }

  async function deletePost() {
    if (!post) return
    if (
      window.confirm(
        'Are you sure you want to delete this post? This action cannot be undone.',
      )
    ) {
      try {
        await apiDeletePost(tenant, post.id)
        navigate({ to: '/$tenant/social', params: { tenant } })
      } catch {
        alert('Failed to delete post')
      }
    }
  }

  if (!post) return null

  return (
    <>
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex h-14 items-center border-b border-slate-200 bg-white px-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <Link
            to="/$tenant/social"
            params={{ tenant }}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileEdit className="h-4 w-4 text-slate-400" />
            {t('edit_post')}
          </h2>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setAiOpen(true)}
            title={t('generate_with_ai')}
            className="flex items-center gap-1.5 rounded-md border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
          >
            <Sparkles className="h-4 w-4" /> Generate
          </button>
          <button
            onClick={deletePost}
            title={t('delete_post')}
            className="rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={savePost}
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* AI Panel (slide-in from right) */}
      {aiOpen && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              if (!aiStreaming) setAiOpen(false)
            }}
            role="presentation"
          />
          <div className="fixed top-0 right-0 z-30 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                <span className="font-semibold text-slate-900 dark:text-white">
                  {t('generate_with_ai')}
                </span>
              </div>
              <button
                onClick={() => setAiOpen(false)}
                disabled={aiStreaming}
                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-40 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Brand context badge */}
            {brand && (
              <div className="mx-5 mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300">
                {t('ai_brand_context_label')}{' '}
                <span className="font-semibold">{brand.name}</span>
                {brand.tone ? ` · ${brand.tone}` : ''}
              </div>
            )}

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              <div>
                <label
                  htmlFor="ai-prompt"
                  className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
                >
                  {t('ai_instruction_label')}
                </label>
                <textarea
                  id="ai-prompt"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={4}
                  placeholder={t('ai_instruction_placeholder')}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  disabled={aiStreaming}
                />
              </div>

              <button
                onClick={generateContent}
                disabled={!aiPrompt.trim() || aiStreaming}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {aiStreaming ? 'Generating…' : 'Generate'}
              </button>

              {aiError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {aiError}
                </p>
              )}

              {aiPreview && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Preview
                  </p>
                  <div className="min-h-[6rem] rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm whitespace-pre-wrap text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {aiPreview}
                    {aiStreaming && <span className="animate-pulse">▌</span>}
                  </div>
                  {!aiStreaming && (
                    <button
                      onClick={applyPreview}
                      className="mt-2 w-full rounded-lg border border-indigo-300 bg-indigo-50 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                    >
                      {t('apply_to_post')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Main layout */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 p-6 lg:grid-cols-3">
        {/* Editor */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            <label
              htmlFor="post-title"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {t('post_title_label')}
            </label>
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="post-content"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {t('post_content_label')}
            </label>
            <textarea
              id="post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="post-hashtags"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Hashtags{' '}
              <span className="font-normal text-slate-400">
                {t('hashtags_hint')}
              </span>
            </label>
            <input
              id="post-hashtags"
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              Media
            </h3>

            {post.media_files?.length > 0 ? (
              <div
                className={`mb-4 grid gap-2 ${
                  post.media_files.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {post.media_files.map((mediaFile) => (
                  <div
                    key={mediaFile}
                    className="group relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
                  >
                    {isVideo(mediaFile) ? (
                      <video
                        src={`/api/media/${tenant}/${mediaFile}`}
                        controls
                        className="h-full w-full object-cover"
                      >
                        <track kind="captions" />
                      </video>
                    ) : (
                      <img
                        src={`/api/media/${tenant}/${mediaFile}`}
                        alt={t('post_media_label')}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-4 flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 dark:border-slate-600 dark:bg-slate-800/50">
                <span className="text-xs font-medium">
                  {t('no_media_attached')}
                </span>
              </div>
            )}

            <label className="block cursor-pointer">
              <span className="sr-only">{t('media_choose')}</span>
              <input
                type="file"
                multiple
                className="block w-full cursor-pointer text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                onChange={handleFileUpload}
                disabled={uploadingMedia}
              />
            </label>
            {uploadingMedia && (
              <p className="mt-2 animate-pulse text-xs font-medium text-indigo-600">
                {t('media_uploading_dots')}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              {t('ai_workflow_title')}
            </h3>

            {post.workflow ? (
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Strategy
                  </span>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-medium">
                      {post.workflow.strategy?.framework}:
                    </span>{' '}
                    {post.workflow.strategy?.reasoning}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Clarity
                  </span>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {post.workflow.clarity?.changes}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Impact
                  </span>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {post.workflow.impact?.changes}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t('no_workflow_data')}</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              {t('post_info_title')}
            </h3>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center justify-between">
                <span>ID</span>
                <span className="font-mono text-xs">{post.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PostStatus)}
                  className={`rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 ${
                    status === 'approved'
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }`}
                >
                  <option value="draft" className="font-medium text-amber-600">
                    draft
                  </option>
                  <option
                    value="approved"
                    className="font-medium text-emerald-600"
                  >
                    approved
                  </option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span>Media</span>
                <select
                  value={mediaType ?? ''}
                  onChange={(e) => setMediaType(e.target.value)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold tracking-wider text-indigo-600 uppercase focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="image">image</option>
                  <option value="video">video</option>
                  <option value="carousel">carousel</option>
                  <option value="story">story</option>
                </select>
              </div>
            </div>
          </div>

          {publishResults.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
                Publicações
              </h3>
              <div className="space-y-2">
                {publishResults.map((result) => {
                  const cfg =
                    PLATFORM_CONFIG[
                      result.platform as keyof typeof PLATFORM_CONFIG
                    ]
                  const color = cfg?.color ?? '#64748b'
                  return (
                    <div
                      key={result.id}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase"
                          style={{ background: `${color}22`, color }}
                        >
                          {cfg?.label ?? result.platform}
                        </span>
                        {result.status === 'published' ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            <span className="text-xs text-slate-500">
                              {result.published_at
                                ? new Date(result.published_at).toLocaleString(
                                    'pt-BR',
                                    {
                                      dateStyle: 'short',
                                      timeStyle: 'short',
                                    },
                                  )
                                : 'Published'}
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                            <span
                              className="min-w-0 truncate text-xs text-red-500"
                              title={result.error_message ?? ''}
                            >
                              {result.error_message ?? 'Failed'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
