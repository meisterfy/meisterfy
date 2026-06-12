import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Send, AlertCircle } from 'lucide-react'
import type { PostShape } from '@/lib/social'
import { Drawer } from '@/components/ui/drawer'
import { publishToMeta, type ConnectorResource } from '@/lib/api/connector-resources'

const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500'

const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

interface PublishDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: PostShape | null
  tenant: string
  metaAccounts: ConnectorResource[]
  onPublished: (id: string) => void
}

export function PublishDrawer({
  open,
  onOpenChange,
  draft,
  tenant,
  metaAccounts,
  onPublished,
}: PublishDrawerProps) {
  const { t } = useTranslation('social-media')
  const [publishAccountId, setPublishAccountId] = useState('')
  const [publishPlatform, setPublishPlatform] = useState<'instagram' | 'facebook'>('instagram')
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  // Seed publish fields when the drawer opens / draft / accounts change
  const [prevSync, setPrevSync] = useState<{
    open: boolean
    draft: typeof draft
    metaAccounts: typeof metaAccounts
  } | null>(null)
  if (
    !prevSync ||
    open !== prevSync.open ||
    draft !== prevSync.draft ||
    metaAccounts !== prevSync.metaAccounts
  ) {
    setPrevSync({ open, draft, metaAccounts })
    if (open && draft) {
      setPublishAccountId(metaAccounts[0]?.id ?? '')
      setPublishPlatform('instagram')
      setPublishError(null)
    }
  }

  async function doPublish() {
    if (!draft || !publishAccountId) return
    setIsPublishing(true)
    setPublishError(null)
    try {
      await publishToMeta(tenant, {
        post_id: draft.id,
        account_id: publishAccountId,
        platform: publishPlatform,
      })
      onPublished(draft.id)
      onOpenChange(false)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={t('publish_to_meta')} headerless>
      <div className="flex h-full flex-col">
        {draft && (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('publish_to_meta')}
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
                {metaAccounts.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          {t('publish_no_accounts')}
                        </p>
                        <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                          {t('publish_no_accounts_hint')}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className={labelCls}>{t('publish_account_label')}</p>
                      <select
                        value={publishAccountId}
                        onChange={(e) => setPublishAccountId(e.target.value)}
                        className={inputCls}
                      >
                        {metaAccounts.map((acc) => {
                          const igUsername = (acc.metadata?.ig_username as string | undefined) ?? ''
                          return (
                            <option key={acc.id} value={acc.id}>
                              {acc.resource_name ?? acc.resource_id}
                              {igUsername ? ` (IG: ${igUsername})` : ''}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                    <div>
                      <p className={labelCls}>Platform</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPublishPlatform('instagram')}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            publishPlatform === 'instagram'
                              ? 'border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-900/20 dark:text-pink-400'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          Instagram
                        </button>
                        <button
                          onClick={() => setPublishPlatform('facebook')}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            publishPlatform === 'facebook'
                              ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          Facebook
                        </button>
                      </div>
                    </div>
                    {publishError && (
                      <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {publishError}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <button
                onClick={doPublish}
                disabled={!publishAccountId || isPublishing || metaAccounts.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {isPublishing ? 'Publishing…' : 'Publish Now'}
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
