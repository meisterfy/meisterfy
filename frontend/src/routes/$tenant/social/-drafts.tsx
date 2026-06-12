import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileEdit,
  Check,
  ImagePlus,
  Plus,
  Pencil,
  CalendarPlus,
  Send,
  Trash2,
  Sparkles,
} from 'lucide-react'
import {
  PLATFORM_CONFIG as PLATFORM,
  normPlatforms,
  type PostShape,
  type PostPlatform,
} from '@/lib/social'
import {
  getPosts,
  updatePostStatus,
  deletePost as apiDeletePost,
  type PostStatus,
} from '@/lib/api/posts'
import {
  getConnectorResources,
  type ConnectorResource,
} from '@/lib/api/connector-resources'
import { normalizePost } from '@/lib/utils/transforms'
import { ProviderIcon } from '@/components/provider-icon'
import { StatusBadge } from '@/components/social/status-badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CreateDraftDrawer } from '@/components/social/create-draft-drawer'
import { EditDraftDrawer } from '@/components/social/edit-draft-drawer'
import { ScheduleDrawer } from '@/components/social/schedule-drawer'
import { PublishDrawer } from '@/components/social/publish-drawer'
import { AiDraftGenerator } from '@/components/social/ai-draft-generator'
import { Route } from './drafts'

const isVideo = (f: string) => /\.(mp4|webm)$/i.test(f)

function PlatformBadge({ platform: plt }: { platform: PostPlatform }) {
  const cfg = PLATFORM[plt]
  return (
    <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
      <div className="h-3.5 w-3.5">
        <ProviderIcon provider={plt} />
      </div>
      {cfg?.label ?? plt}
    </span>
  )
}

export function DraftsRoute() {
  const { tenant } = Route.useParams()
  const { t } = useTranslation('social-media')

  const [drafts, setDrafts] = useState<PostShape[]>([])
  const [metaAccounts, setMetaAccounts] = useState<ConnectorResource[]>([])

  useEffect(() => {
    let active = true
    Promise.all([
      getPosts(tenant).catch(() => []),
      getConnectorResources(tenant, 'meta', 'page').catch(() => []),
    ]).then(([all, accounts]) => {
      if (!active) return
      setDrafts(
        all
          .filter((p) => p.status === 'draft' || p.status === 'approved')
          .map(normalizePost),
      )
      setMetaAccounts(accounts)
    })
    return () => {
      active = false
    }
  }, [tenant])

  // ── Create ─────────────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [showAiGenerator, setShowAiGenerator] = useState(false)

  // ── Edit ───────────────────────────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false)
  const [selectedForEdit, setSelectedForEdit] = useState<PostShape | null>(null)

  // ── Schedule ───────────────────────────────────────────────────────────────
  const [showSchedule, setShowSchedule] = useState(false)
  const [selectedForSchedule, setSelectedForSchedule] =
    useState<PostShape | null>(null)

  // ── Publish ────────────────────────────────────────────────────────────────
  const [showPublish, setShowPublish] = useState(false)
  const [selectedForPublish, setSelectedForPublish] =
    useState<PostShape | null>(null)

  // ── Inline delete ──────────────────────────────────────────────────────────
  const [postToDelete, setPostToDelete] = useState<PostShape | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeletingPost, setIsDeletingPost] = useState(false)

  // ── Approve toggle ─────────────────────────────────────────────────────────
  const [approvingId, setApprovingId] = useState<string | null>(null)

  function openEdit(draft: PostShape) {
    setSelectedForEdit(draft)
    setShowEdit(true)
  }
  function openSchedule(draft: PostShape) {
    setSelectedForSchedule(draft)
    setShowSchedule(true)
  }
  function openPublish(draft: PostShape) {
    setSelectedForPublish(draft)
    setShowPublish(true)
  }
  function requestDelete(post: PostShape) {
    setPostToDelete(post)
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!postToDelete) return
    setIsDeletingPost(true)
    try {
      await apiDeletePost(tenant, postToDelete.id)
      setDrafts((ds) => ds.filter((d) => d.id !== postToDelete.id))
      if (selectedForEdit?.id === postToDelete.id) setShowEdit(false)
      setPostToDelete(null)
      setShowDeleteConfirm(false)
    } finally {
      setIsDeletingPost(false)
    }
  }

  async function toggleApprove(post: PostShape) {
    setApprovingId(post.id)
    const newStatus = post.status === 'approved' ? 'draft' : 'approved'
    try {
      await updatePostStatus(tenant, post.id, newStatus as PostStatus)
      setDrafts((ds) =>
        ds.map((d) => (d.id === post.id ? { ...d, status: newStatus } : d)),
      )
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="mb-0.5 flex items-center gap-2">
              <FileEdit className="h-5 w-5 text-slate-400" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Drafts
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800">
                {drafts.length}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('drafts_subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAiGenerator(true)}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400"
            >
              <Sparkles className="h-4 w-4" />
              {t('generate_with_ai')}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              {t('draft_new_title')}
            </button>
          </div>
        </div>

        {drafts.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 p-16 text-center dark:border-slate-700">
            <FileEdit className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              {t('no_drafts_yet')}
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {t('create_first_draft')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {drafts.map((post) => (
              <div
                key={post.id}
                className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Thumbnail */}
                {post.media_files?.length > 0 ? (
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700">
                    {isVideo(post.media_files[0]) ? (
                      <video
                        src={`/api/media/${tenant}/${post.media_files[0]}`}
                        className="h-full w-full object-contain"
                      >
                        <track kind="captions" />
                      </video>
                    ) : (
                      <img
                        src={`/api/media/${tenant}/${post.media_files[0]}`}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                    <ImagePlus className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={post.status} />
                    {normPlatforms(post.platform).map((plt) => (
                      <PlatformBadge key={plt} platform={plt} />
                    ))}
                    <span className="truncate font-mono text-xs text-slate-400">
                      {post.id}
                    </span>
                  </div>
                  <p className="mb-1 font-semibold text-slate-900 dark:text-white">
                    {post.title}
                  </p>
                  <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                    {post.content}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => openEdit(post)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => toggleApprove(post)}
                    disabled={approvingId === post.id}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      post.status === 'approved'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {post.status === 'approved' ? 'Approved' : 'Approve'}
                  </button>
                  <button
                    onClick={() => openSchedule(post)}
                    disabled={post.status !== 'approved'}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      post.status === 'approved'
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400'
                        : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 opacity-50 dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    <CalendarPlus className="h-3.5 w-3.5" /> Schedule
                  </button>
                  {post.status === 'approved' && (
                    <button
                      onClick={() => openPublish(post)}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {t('publish_to_meta')}
                    </button>
                  )}
                  <button
                    onClick={() => requestDelete(post)}
                    className="rounded-lg border border-transparent p-1.5 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-800 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('delete_draft_title')}
        description={
          postToDelete
            ? `"${postToDelete.title}" will be permanently removed.`
            : ''
        }
        isLoading={isDeletingPost}
        onConfirm={confirmDelete}
      />

      <AiDraftGenerator
        open={showAiGenerator}
        onOpenChange={setShowAiGenerator}
        tenant={tenant}
        onCreated={(created) => setDrafts((ds) => [...created, ...ds])}
      />

      <CreateDraftDrawer
        open={showCreate}
        onOpenChange={setShowCreate}
        tenant={tenant}
        onCreated={(draft) => setDrafts((ds) => [draft, ...ds])}
      />

      <EditDraftDrawer
        open={showEdit}
        onOpenChange={setShowEdit}
        draft={selectedForEdit}
        tenant={tenant}
        onSaved={(updated) =>
          setDrafts((ds) => ds.map((d) => (d.id === updated.id ? updated : d)))
        }
        onDeleted={(id) => {
          setDrafts((ds) => ds.filter((d) => d.id !== id))
          if (selectedForEdit?.id === id) setShowEdit(false)
        }}
      />

      <ScheduleDrawer
        open={showSchedule}
        onOpenChange={setShowSchedule}
        draft={selectedForSchedule}
        tenant={tenant}
        onScheduled={(id) => setDrafts((ds) => ds.filter((d) => d.id !== id))}
      />

      <PublishDrawer
        open={showPublish}
        onOpenChange={setShowPublish}
        draft={selectedForPublish}
        tenant={tenant}
        metaAccounts={metaAccounts}
        onPublished={(id) => setDrafts((ds) => ds.filter((d) => d.id !== id))}
      />
    </>
  )
}
