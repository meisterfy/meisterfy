import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { PostShape } from '@/lib/social'
import { Drawer } from '@/components/ui/drawer'
import { createPost as apiCreatePost } from '@/lib/api/posts'
import { uploadMedia } from '@/lib/api/media'
import { parseHashtags } from '@/lib/utils/hashtags'
import { normalizePost } from '@/lib/utils/transforms'

const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500'

const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

interface CreateDraftDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant: string
  onCreated: (post: PostShape) => void
}

export function CreateDraftDrawer({
  open,
  onOpenChange,
  tenant,
  onCreated,
}: CreateDraftDrawerProps) {
  const { t } = useTranslation('social-media')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newHashtags, setNewHashtags] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const newMediaInput = useRef<HTMLInputElement>(null)

  // Reset fields when the drawer opens (adjust state during render, not an effect)
  const [prevOpen, setPrevOpen] = useState<boolean | null>(null)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setNewTitle('')
      setNewContent('')
      setNewHashtags('')
    }
  }

  async function createDraft() {
    if (!newTitle.trim() || !newContent.trim()) return
    setIsCreating(true)
    try {
      const tags = parseHashtags(newHashtags)
      const newPost = await apiCreatePost(tenant, {
        title: newTitle,
        content: newContent,
        hashtags: tags,
        status: 'draft',
      })
      const files = newMediaInput.current?.files
      let mediaFiles: string[] = []
      if (files && files.length > 0) {
        try {
          mediaFiles = await uploadMedia(tenant, newPost.id, files)
        } catch {
          /* ignore upload errors */
        }
      }
      onCreated({ ...normalizePost(newPost), media_files: mediaFiles })
      onOpenChange(false)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={t('draft_new_title')} headerless>
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('draft_new_title')}
          </h2>
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
              <label htmlFor="create-title" className={labelCls}>
                Title
              </label>
              <input
                id="create-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                type="text"
                placeholder={t('post_title_placeholder')}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="create-content" className={labelCls}>
                Content
              </label>
              <textarea
                id="create-content"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={5}
                placeholder={t('post_copy_placeholder')}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div>
              <label htmlFor="create-hashtags" className={labelCls}>
                Hashtags{' '}
                <span className="font-normal text-slate-400 normal-case">{t('hashtags_hint')}</span>
              </label>
              <input
                id="create-hashtags"
                value={newHashtags}
                onChange={(e) => setNewHashtags(e.target.value)}
                type="text"
                placeholder={t('hashtag_placeholder')}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="create-image" className={labelCls}>
                Image <span className="font-normal text-slate-400 normal-case">(optional)</span>
              </label>
              <input
                id="create-image"
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
            onClick={createDraft}
            disabled={!newTitle.trim() || !newContent.trim() || isCreating}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {isCreating ? 'Creating…' : 'Create Draft'}
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
