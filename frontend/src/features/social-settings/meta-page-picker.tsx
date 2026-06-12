import { useState, useEffect, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '@/components/ui/drawer'
import { getAvailableMetaPages, activateMetaPage } from '@/lib/api/social-accounts'
import type { MetaPage, ConnectorResource } from '@/lib/api/social-accounts'

interface MetaPagePickerProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  tenant: string
  onAdded: (resource: ConnectorResource) => void
}

function MetaPagePicker({ open, onOpenChange, tenant, onAdded }: MetaPagePickerProps) {
  const { t } = useTranslation('settings')
  const { t: tGlobals } = useTranslation('globals')

  const [pages, setPages] = useState<MetaPage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

  // Reset state + flag loading when the drawer opens (adjust state during render)
  const [prevOpen, setPrevOpen] = useState<boolean | null>(null)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSearch('')
      setAddError(null)
      setError(null)
      setLoading(true)
    }
  }

  useEffect(() => {
    if (!open) return
    getAvailableMetaPages(tenant)
      .then((p) => setPages(p))
      .catch(() => setError(t('social_picker_error')))
      .finally(() => setLoading(false))
  }, [open, tenant, t])

  const filtered = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase()
      return pages.filter(
        (p) =>
          p.page_name.toLowerCase().includes(q) ||
          (p.ig_username ?? '').toLowerCase().includes(q),
      )
    }
    return pages
  }, [pages, search])

  async function add(page: MetaPage) {
    setAddingId(page.page_id)
    setAddError(null)
    try {
      const resource = await activateMetaPage(tenant, {
        page_id: page.page_id,
        page_name: page.page_name,
        ig_user_id: page.ig_user_id,
        ig_username: page.ig_username,
      })
      setPages((ps) =>
        ps.map((p) => (p.page_id === page.page_id ? { ...p, already_connected: true } : p)),
      )
      onAdded(resource)
      onOpenChange(false)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : tGlobals('error_generic'))
    } finally {
      setAddingId(null)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={t('social_picker_title')} headerless>
      {/* Custom chrome — mirrors Svelte Dialog.Content */}
      <div className='border-border/30 flex items-center justify-between border-b p-4'>
        <p className='text-base font-semibold text-slate-900 dark:text-white'>
          {t('social_picker_title')}
        </p>
        <button
          type='button'
          onClick={() => onOpenChange(false)}
          className='rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300'
        >
          <X className='h-5 w-5' />
        </button>
      </div>

      <div className='border-border/30 border-b p-4'>
        <input
          type='search'
          placeholder={t('social_picker_search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white'
        />
      </div>

      <div className='flex-1 overflow-y-auto p-4'>
        {loading ? (
          <p className='py-8 text-center text-sm text-slate-500 dark:text-slate-400'>
            {t('social_picker_loading')}
          </p>
        ) : error ? (
          <p className='rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400'>
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <p className='py-8 text-center text-sm text-slate-500 dark:text-slate-400'>
            {t('social_picker_empty')}
          </p>
        ) : (
          <ul className='divide-y divide-slate-100 dark:divide-slate-800'>
            {filtered.map((page) => (
              <li key={page.page_id} className='flex items-center gap-3 py-3'>
                <div className='flex shrink-0 items-center gap-1'>
                  {page.ig_user_id && (
                    <span className='rounded bg-pink-100 px-1.5 py-0.5 text-[10px] font-bold text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'>
                      IG
                    </span>
                  )}
                  <span className='rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'>
                    FB
                  </span>
                </div>

                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium text-slate-900 dark:text-white'>
                    {page.page_name}
                  </p>
                  {page.ig_username && (
                    <p className='text-xs text-slate-500 dark:text-slate-400'>@{page.ig_username}</p>
                  )}
                </div>

                {page.already_connected ? (
                  <span className='shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400'>
                    {t('social_picker_connected')}
                  </span>
                ) : (
                  <button
                    type='button'
                    disabled={addingId === page.page_id}
                    onClick={() => add(page)}
                    className='flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20'
                  >
                    <Plus className='h-3.5 w-3.5' />
                    {t('social_picker_add')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {addError && (
          <p className='mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400'>
            {addError}
          </p>
        )}
      </div>
    </Drawer>
  )
}

export { MetaPagePicker }
