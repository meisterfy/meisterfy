import type React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Trash2, ImagePlus } from 'lucide-react'
import type { PostShape, PostPlatform } from '@/lib/social'
import { normPlatforms } from '@/lib/social'
import { Drawer } from '@/components/ui/drawer'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatusBadge } from '@/components/social/status-badge'
import { PlatformSelect } from '@/components/social/platform-select'
import { updatePost, deletePost as apiDeletePost } from '@/lib/api/posts'
import { uploadMedia, deleteMedia } from '@/lib/api/media'
import { parseHashtags } from '@/lib/utils/hashtags'

const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500'

const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

const isVideo = (f: string) => /\.(mp4|webm)$/i.test(f)

interface EditDraftDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: PostShape | null
  tenant: string
  onSaved: (updated: PostShape) => void
  onDeleted: (id: string) => void
}

export function EditDraftDrawer({
  open,
  onOpenChange,
  draft,
  tenant,
  onSaved,
  onDeleted,
}: EditDraftDrawerProps) {
  const { t } = useTranslation('social-media')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editHashtags, setEditHashtags] = useState('')
  const [editPlatforms, setEditPlatforms] = useState<PostPlatform[]>([])
  const [editMediaFiles, setEditMediaFiles] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeletingPost, setIsDeletingPost] = useState(false)

  // Sync fields when the drawer opens / draft changes (adjust state during render)
  const [prevSync, setPrevSync] = useState<{
    open: boolean
    draft: typeof draft
  } | null>(null)
  if (!prevSync || open !== prevSync.open || draft !== prevSync.draft) {
    setPrevSync({ open, draft })
    if (open && draft) {
      setEditTitle(draft.title)
      setEditContent(draft.content)
      setEditHashtags(draft.hashtags?.join(' ') ?? '')
      setEditPlatforms(normPlatforms(draft.platform))
      setEditMediaFiles([...(draft.media_files ?? [])])
    }
  }

  async function saveEdit() {
    if (!draft || !editTitle.trim() || !editContent.trim()) return
    setIsSaving(true)
    try {
      const tags = parseHashtags(editHashtags)
      await updatePost(tenant, draft.id, {
        title: editTitle,
        content: editContent,
        hashtags: tags,
        platforms: editPlatforms,
      })
      onSaved({
        ...draft,
        title: editTitle,
        content: editContent,
        hashtags: tags,
        platform: editPlatforms,
        media_files: editMediaFiles,
      })
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleMediaUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!draft) return
    const input = event.target
    const files = input.files
    if (!files || files.length === 0) return
    setIsUploadingMedia(true)
    try {
      const urls = await uploadMedia(tenant, draft.id, files)
      setEditMediaFiles(urls)
      input.value = ''
    } finally {
      setIsUploadingMedia(false)
    }
  }

  async function removeMedia() {
    if (!draft) return
    await deleteMedia(tenant, draft.id)
    setEditMediaFiles([])
  }

  async function confirmDelete() {
    if (!draft) return
    setIsDeletingPost(true)
    try {
      await apiDeletePost(tenant, draft.id)
      onDeleted(draft.id)
      onOpenChange(false)
      setShowDeleteConfirm(false)
    } finally {
      setIsDeletingPost(false)
    }
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} title={t('edit_post')} headerless>
        <div className="flex h-full flex-col">
          {draft && (
            <>
              <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                <div className="min-w-0 flex-1 pr-4">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={draft.status} />
                    {draft.media_type && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 uppercase dark:bg-slate-800">
                        {draft.media_type}
                      </span>
                    )}
                    {draft.workflow?.strategy?.framework && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                        {draft.workflow.strategy.framework}
                      </span>
                    )}
                  </div>
                  <p className="truncate font-mono text-xs text-slate-400">{draft.id}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {draft.workflow?.strategy?.reasoning && (
                  <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                    <p className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                      {t('strategy_reasoning')}
                    </p>
                    <p className="text-sm leading-relaxed text-slate-600 italic dark:text-slate-400">
                      {draft.workflow.strategy.reasoning}
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-4">
                  <div>
                    <label htmlFor="edit-title" className={labelCls}>
                      Title
                    </label>
                    <input
                      id="edit-title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      type="text"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-content" className={labelCls}>
                      Content
                    </label>
                    <textarea
                      id="edit-content"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={8}
                      className={`${inputCls} resize-y`}
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-hashtags" className={labelCls}>
                      Hashtags{' '}
                      <span className="font-normal text-slate-400 normal-case">
                        {t('hashtags_hint')}
                      </span>
                    </label>
                    <input
                      id="edit-hashtags"
                      value={editHashtags}
                      onChange={(e) => setEditHashtags(e.target.value)}
                      type="text"
                      className={inputCls}
                    />
                    {editHashtags && (
                      <p className="mt-1.5 flex flex-wrap gap-1 text-xs text-indigo-500 dark:text-indigo-400">
                        {parseHashtags(editHashtags).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className={labelCls}>Platform</p>
                    <PlatformSelect value={editPlatforms} onChange={setEditPlatforms} />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className={labelCls}>Image</p>
                      {editMediaFiles.length > 0 && (
                        <button
                          onClick={removeMedia}
                          className="flex items-center gap-1 text-xs text-red-500 transition-colors hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                          {t('media_remove_all')}
                        </button>
                      )}
                    </div>
                    {editMediaFiles.length > 0 ? (
                      <div
                        className={`mb-3 grid gap-2 ${
                          editMediaFiles.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                        }`}
                      >
                        {editMediaFiles.map((f) => (
                          <div
                            key={f}
                            className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700"
                          >
                            {isVideo(f) ? (
                              <video
                                src={`/api/media/${tenant}/${f}`}
                                controls
                                className="max-h-full max-w-full object-contain"
                              >
                                <track kind="captions" />
                              </video>
                            ) : (
                              <img
                                src={`/api/media/${tenant}/${f}`}
                                alt="Media"
                                className="max-h-full max-w-full object-contain"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mb-3 flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 text-xs font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800/50">
                        <ImagePlus className="mr-2 h-4 w-4" />
                        {t('no_image_attached')}
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                      multiple
                      onChange={handleMediaUpload}
                      disabled={isUploadingMedia}
                      className="w-full cursor-pointer text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
                    />
                    {isUploadingMedia && (
                      <p className="mt-1 animate-pulse text-xs text-indigo-600 dark:text-indigo-400">
                        {t('media_uploading')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                <button
                  onClick={saveEdit}
                  disabled={!editTitle.trim() || !editContent.trim() || isSaving}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  onClick={() => onOpenChange(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('delete_draft_title')}
        description={draft ? `"${draft.title}" will be permanently removed.` : ''}
        isLoading={isDeletingPost}
        onConfirm={confirmDelete}
      />
    </>
  )
}
