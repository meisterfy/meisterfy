import type React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Trash2, ImagePlus } from 'lucide-react'
import type { PostShape, PostPlatform } from '@/lib/social'
import { PLATFORM_CONFIG as PLATFORM, normPlatforms } from '@/lib/social'
import { Drawer } from '@/components/ui/drawer'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatusBadge } from '@/components/social/status-badge'
import { PlatformSelect } from '@/components/social/platform-select'
import { ProviderIcon } from '@/components/provider-icon'
import { updatePost, deletePost as apiDeletePost } from '@/lib/api/posts'
import { uploadMedia, deleteMedia } from '@/lib/api/media'
import { parseHashtags } from '@/lib/utils/hashtags'

const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500'

const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

const isVideo = (f: string) => /\.(mp4|webm)$/i.test(f)

interface EditPostDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: PostShape | null
  tenant: string
  onSaved: (updated: PostShape) => void
  onDeleted: (id: string) => void
}

export function EditPostDrawer({
  open,
  onOpenChange,
  post,
  tenant,
  onSaved,
  onDeleted,
}: EditPostDrawerProps) {
  const { t } = useTranslation('social-media')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editHashtags, setEditHashtags] = useState('')
  const [editPlatforms, setEditPlatforms] = useState<PostPlatform[]>([])
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editMediaFiles, setEditMediaFiles] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeletingPost, setIsDeletingPost] = useState(false)

  // Sync fields when the drawer opens / post changes (adjust state during render)
  const [prevSync, setPrevSync] = useState<{
    open: boolean
    post: typeof post
  } | null>(null)
  if (!prevSync || open !== prevSync.open || post !== prevSync.post) {
    setPrevSync({ open, post })
    if (open && post) {
      setEditTitle(post.title)
      setEditContent(post.content)
      setEditHashtags(post.hashtags?.join(' ') ?? '')
      setEditPlatforms(normPlatforms(post.platform))
      setEditDate(post.scheduled_date ?? '')
      setEditTime(post.scheduled_time ?? '')
      setEditMediaFiles([...(post.media_files ?? [])])
    }
  }

  async function savePost() {
    if (!post || !editTitle.trim() || !editContent.trim()) return
    setIsSaving(true)
    try {
      const tags = parseHashtags(editHashtags)
      await updatePost(tenant, post.id, {
        title: editTitle,
        content: editContent,
        hashtags: tags,
        platforms: editPlatforms,
        scheduled_date: editDate || undefined,
        scheduled_time: editTime || undefined,
      })
      onSaved({
        ...post,
        title: editTitle,
        content: editContent,
        hashtags: tags,
        platform: editPlatforms,
        scheduled_date: editDate || undefined,
        scheduled_time: editTime || undefined,
        media_files: editMediaFiles,
      })
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleMediaUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!post) return
    const input = event.target
    const files = input.files
    if (!files || files.length === 0) return
    setIsUploadingMedia(true)
    try {
      const urls = await uploadMedia(tenant, post.id, files)
      setEditMediaFiles(urls)
      input.value = ''
    } finally {
      setIsUploadingMedia(false)
    }
  }

  async function removeMedia() {
    if (!post) return
    await deleteMedia(tenant, post.id)
    setEditMediaFiles([])
  }

  async function confirmDelete() {
    if (!post) return
    setIsDeletingPost(true)
    try {
      await apiDeletePost(tenant, post.id)
      onDeleted(post.id)
      onOpenChange(false)
      setShowDeleteConfirm(false)
    } catch {
      // ignore
    } finally {
      setIsDeletingPost(false)
    }
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} title={t('edit_post')} headerless>
        <div className="flex h-full flex-col">
          {post && (
            <>
              <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                <div className="min-w-0 flex-1 pr-4">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={post.status} />
                    {normPlatforms(post.platform).map(
                      (plt) =>
                        PLATFORM[plt] && (
                          <span key={plt} className="flex items-center gap-1 text-xs text-slate-500">
                            <ProviderIcon provider={plt} className="h-2.5 w-2.5 shrink-0" />
                            {PLATFORM[plt].label}
                          </span>
                        ),
                    )}
                  </div>
                  <p className="truncate font-mono text-xs text-slate-400">{post.id}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {post.status !== 'published' && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                  <button
                    onClick={() => onOpenChange(false)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {post.status === 'published' ? (
                  <>
                    <p className="mb-2 font-bold text-slate-900 dark:text-white">{post.title}</p>
                    {post.scheduled_date && (
                      <p className="mb-3 text-xs text-slate-400">
                        {post.scheduled_date}
                        {post.scheduled_time ? ' · ' + post.scheduled_time : ''}
                      </p>
                    )}
                    {editMediaFiles.length > 0 && (
                      <div
                        className={`mb-4 grid gap-2 ${
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
                    )}
                    <p className="mb-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                      {post.content}
                    </p>
                    {post.hashtags?.length ? (
                      <p className="flex flex-wrap gap-1 text-xs text-indigo-500 dark:text-indigo-400">
                        {post.hashtags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className={labelCls}>Platform</p>
                      <PlatformSelect value={editPlatforms} onChange={setEditPlatforms} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="edit-date" className={labelCls}>
                          Date
                        </label>
                        <input
                          id="edit-date"
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-time" className={labelCls}>
                          Time{' '}
                          <span className="font-normal text-slate-400 normal-case">(opt.)</span>
                        </label>
                        <input
                          id="edit-time"
                          type="time"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
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
                        rows={7}
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
                )}
              </div>

              {post.status !== 'published' && (
                <div className="flex shrink-0 gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                  <button
                    onClick={savePost}
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
              )}
            </>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('delete_post_title')}
        description={post ? `"${post.title}" will be permanently removed.` : ''}
        isLoading={isDeletingPost}
        onConfirm={confirmDelete}
      />
    </>
  )
}
