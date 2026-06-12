import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Clock } from 'lucide-react'
import type { PostShape, PostPlatform } from '@/lib/social'
import { Drawer } from '@/components/ui/drawer'
import { PlatformSelect } from '@/components/social/platform-select'
import { createPost as apiCreatePost } from '@/lib/api/posts'
import { uploadMedia } from '@/lib/api/media'
import { parseHashtags } from '@/lib/utils/hashtags'
import { normalizePost } from '@/lib/utils/transforms'
import { getConnectedMetaPages, type ConnectedMetaPage } from '@/lib/api/social-accounts'

const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500'

const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

interface NewPostDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant: string
  defaultDate?: string
  onCreated: (post: PostShape) => void
}

export function NewPostDrawer({
  open,
  onOpenChange,
  tenant,
  defaultDate = '',
  onCreated,
}: NewPostDrawerProps) {
  const { t } = useTranslation('social-media')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newHashtags, setNewHashtags] = useState('')
  const [newTime, setNewTime] = useState('10:00')
  const [newPlatforms, setNewPlatforms] = useState<PostPlatform[]>(['instagram_feed'])
  const [isCreating, setIsCreating] = useState(false)
  const [metaPages, setMetaPages] = useState<ConnectedMetaPage[]>([])
  const [metaPagesLoaded, setMetaPagesLoaded] = useState(false)
  const [selectedResourceId, setSelectedResourceId] = useState('')
  const newMediaInput = useRef<HTMLInputElement>(null)
  // mirrors Svelte's untrack(metaPagesLoaded) — read without re-triggering the open effect
  const metaPagesLoadedRef = useRef(false)

  useEffect(() => {
    if (open) {
      setNewTitle('')
      setNewContent('')
      setNewHashtags('')
      setNewTime('10:00')
      setNewPlatforms(['instagram_feed'])
      setSelectedResourceId('')
      if (!metaPagesLoadedRef.current) {
        getConnectedMetaPages(tenant)
          .then((pages) => {
            setMetaPages(pages)
            metaPagesLoadedRef.current = true
            setMetaPagesLoaded(true)
          })
          .catch(() => {
            metaPagesLoadedRef.current = true
            setMetaPagesLoaded(true)
          })
      }
    }
  }, [open, tenant])

  async function createPost() {
    if (!defaultDate || !newTitle.trim() || !newContent.trim()) return
    setIsCreating(true)
    try {
      const tags = parseHashtags(newHashtags)
      const res = await apiCreatePost(tenant, {
        title: newTitle,
        content: newContent,
        hashtags: tags,
        platforms: newPlatforms,
        status: 'scheduled',
        scheduled_date: defaultDate,
        scheduled_time: newTime || undefined,
        connector_resource_id: selectedResourceId || null,
      })
      const files = newMediaInput.current?.files
      let mediaFiles: string[] = []
      if (files && files.length > 0) {
        try {
          mediaFiles = await uploadMedia(tenant, res.id, files)
        } catch {
          // ignore upload errors — post was created successfully
        }
      }
      onCreated({ ...normalizePost(res), media_files: mediaFiles })
      onOpenChange(false)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={t('post_new_title')} headerless>
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('post_new_title')}
            </h2>
            {defaultDate && <p className="font-mono text-xs text-slate-400">{defaultDate}</p>}
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
            <div>
              <p className={labelCls}>Platform</p>
              <PlatformSelect value={newPlatforms} onChange={setNewPlatforms} />
            </div>
            {metaPages.length > 0 ? (
              <div>
                <label htmlFor="new-meta-account" className={labelCls}>
                  {t('meta_account_label')}
                </label>
                <select
                  id="new-meta-account"
                  value={selectedResourceId}
                  onChange={(e) => setSelectedResourceId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">{t('meta_account_none')}</option>
                  {metaPages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.resource_name ?? 'Page'}
                      {page.metadata.ig_username
                        ? ` (@${page.metadata.ig_username})`
                        : ' (Facebook only)'}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              metaPagesLoaded && (
                <p className="text-xs text-slate-400">{t('meta_connect_hint')}</p>
              )
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-date" className={labelCls}>
                  Date <span className="font-normal text-slate-400 normal-case">(fixed)</span>
                </label>
                <input
                  id="new-date"
                  type="date"
                  value={defaultDate}
                  disabled
                  className={`${inputCls} cursor-not-allowed opacity-60`}
                />
              </div>
              <div>
                <label htmlFor="new-time" className={labelCls}>
                  Time <span className="font-normal text-slate-400 normal-case">(opt.)</span>
                </label>
                <input
                  id="new-time"
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label htmlFor="new-title" className={labelCls}>
                Title
              </label>
              <input
                id="new-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                type="text"
                placeholder={t('post_title_placeholder')}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="new-content" className={labelCls}>
                Content
              </label>
              <textarea
                id="new-content"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={5}
                placeholder={t('post_copy_placeholder')}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div>
              <label htmlFor="new-hashtags" className={labelCls}>
                Hashtags{' '}
                <span className="font-normal text-slate-400 normal-case">{t('hashtags_hint')}</span>
              </label>
              <input
                id="new-hashtags"
                value={newHashtags}
                onChange={(e) => setNewHashtags(e.target.value)}
                type="text"
                placeholder={t('hashtag_placeholder')}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="new-image" className={labelCls}>
                Image <span className="font-normal text-slate-400 normal-case">(optional)</span>
              </label>
              <input
                id="new-image"
                ref={newMediaInput}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                multiple
                className="w-full cursor-pointer text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <button
            onClick={createPost}
            disabled={!newTitle.trim() || !newContent.trim() || isCreating}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            <Clock className="h-4 w-4" />
            {isCreating ? 'Saving…' : 'Add to Planner'}
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </Drawer>
  )
}
