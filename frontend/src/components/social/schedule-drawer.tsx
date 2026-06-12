import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Clock } from 'lucide-react'
import type { PostShape, PostPlatform } from '@/lib/social'
import { normPlatforms } from '@/lib/social'
import { Drawer } from '@/components/ui/drawer'
import { PlatformSelect } from '@/components/social/platform-select'
import { updatePost, updatePostStatus } from '@/lib/api/posts'
import { getConnectedMetaPages, type ConnectedMetaPage } from '@/lib/api/social-accounts'

const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500'

const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

interface ScheduleDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: PostShape | null
  tenant: string
  onScheduled: (id: string) => void
}

export function ScheduleDrawer({
  open,
  onOpenChange,
  draft,
  tenant,
  onScheduled,
}: ScheduleDrawerProps) {
  const { t } = useTranslation('social-media')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('10:00')
  const [schedPlatforms, setSchedPlatforms] = useState<PostPlatform[]>(['instagram_feed'])
  const [isSaving, setIsSaving] = useState(false)
  const [metaPages, setMetaPages] = useState<ConnectedMetaPage[]>([])
  const [metaPagesLoaded, setMetaPagesLoaded] = useState(false)
  const [selectedResourceId, setSelectedResourceId] = useState('')
  // mirrors Svelte's plain metaPagesLoaded read inside the effect — load once
  const metaPagesLoadedRef = useRef(false)

  // Seed schedule fields when the drawer opens / draft changes (during render)
  const [prevSync, setPrevSync] = useState<{
    open: boolean
    draft: typeof draft
  } | null>(null)
  if (!prevSync || open !== prevSync.open || draft !== prevSync.draft) {
    setPrevSync({ open, draft })
    if (open && draft) {
      setSchedDate('')
      setSchedTime('10:00')
      const draftPlatforms = normPlatforms(draft.platform)
      setSchedPlatforms(
        draftPlatforms.length > 0 ? draftPlatforms : ['instagram_feed'],
      )
      setSelectedResourceId(draft.connector_resource_id ?? '')
    }
  }

  // Load connected Meta pages once, the first time the drawer is opened
  useEffect(() => {
    if (open && draft && !metaPagesLoadedRef.current) {
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
  }, [open, draft, tenant])

  async function saveSchedule() {
    if (!draft || !schedDate) return
    setIsSaving(true)
    try {
      await updatePost(tenant, draft.id, {
        platforms: schedPlatforms,
        connector_resource_id: selectedResourceId || null,
      })
      await updatePostStatus(tenant, draft.id, 'scheduled', {
        scheduled_date: schedDate,
        scheduled_time: schedTime || undefined,
      })
      onScheduled(draft.id)
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={t('schedule_title')} headerless>
      <div className="flex h-full flex-col">
        {draft && (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('schedule_title')}
                </h2>
                <p className="truncate text-sm text-slate-500">{draft.title}</p>
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
                  <PlatformSelect value={schedPlatforms} onChange={setSchedPlatforms} />
                </div>
                {metaPages.length > 0 ? (
                  <div>
                    <label htmlFor="sched-meta-account" className={labelCls}>
                      {t('meta_account_label')}
                    </label>
                    <select
                      id="sched-meta-account"
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
                    <label htmlFor="sched-date" className={labelCls}>
                      Date
                    </label>
                    <input
                      id="sched-date"
                      type="date"
                      value={schedDate}
                      onChange={(e) => setSchedDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="sched-time" className={labelCls}>
                      Time <span className="font-normal text-slate-400 normal-case">(opt.)</span>
                    </label>
                    <input
                      id="sched-time"
                      type="time"
                      value={schedTime}
                      onChange={(e) => setSchedTime(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <button
                onClick={saveSchedule}
                disabled={!schedDate || isSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                <Clock className="h-4 w-4" />
                {isSaving ? 'Saving…' : 'Add to Planner'}
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
  )
}
