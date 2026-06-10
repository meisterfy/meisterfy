import { useState, useEffect, useMemo } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Shield, FileJson } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import { useAuth } from '@/store/auth'
import { getAuditLog } from '@/lib/api/audit-log'
import type { AuditEntry } from '@/lib/api/audit-log'
import { getDiffs } from '@/lib/utils/diff'
import { SectionTitle } from '@/components/section-title'
import { SettingsSkeleton } from '@/components/settings-skeleton'
import { DataTable } from '@/components/ui/data-table'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/$tenant/settings/audit')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuditRoute,
})

const PAGE_SIZE = 50
const ENTITY_TYPES = ['', 'post', 'tenant', 'user', 'integration']

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AuditRoute() {
  const { tenant } = Route.useParams()
  const { t } = useTranslation('settings')
  const { t: tGlobals } = useTranslation('globals')

  // ── State ──────────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [filterEntityType, setFilterEntityType] = useState('')
  const [filterUserId, setFilterUserId] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  // ── Load function ──────────────────────────────────────────────────────────
  // Intentional deviation from useQuery: audit is imperatively paginated/filtered
  // with an explicit "Apply" button and manual offset control. useQuery's
  // declarative model does not cleanly express "re-fetch on Apply click with
  // current filter values that might differ from the last fetch" without adding
  // extra state or external query invalidation. The imperative approach mirrors
  // the Svelte source exactly and keeps the mental model consistent.
  //
  // Filter overrides are accepted explicitly so callers that change state and
  // immediately call load() can pass the new values before React batches the
  // state update (otherwise the closure would capture stale state).
  async function load(
    newOffset = 0,
    initial = false,
    overrides?: { entityType?: string; userId?: string },
  ) {
    if (initial) {
      setInitialLoading(true)
    } else {
      setLoading(true)
    }
    setOffset(newOffset)
    const entityType =
      overrides?.entityType !== undefined ? overrides.entityType : filterEntityType
    const userId =
      overrides?.userId !== undefined ? overrides.userId : filterUserId
    try {
      const res = await getAuditLog(tenant, {
        limit: PAGE_SIZE,
        offset: newOffset,
        entity_type: entityType || undefined,
        user_id: userId.trim() || undefined,
      }).catch(() => ({ data: [], total: 0 }))
      setEntries(res.data)
      setTotal(res.total)
    } finally {
      if (initial) {
        setInitialLoading(false)
      } else {
        setLoading(false)
      }
    }
  }

  // Initial load — mirrors the Svelte $effect that resolves data.auditLog
  useEffect(() => {
    void load(0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      {
        id: 'time',
        header: t('audit_col_time'),
        cell: ({ row }) => (
          <span className='text-muted-foreground font-mono text-xs whitespace-nowrap'>
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      {
        id: 'user',
        header: t('audit_col_user'),
        cell: ({ row }) => row.original.user_name || row.original.user_id,
      },
      {
        id: 'action',
        header: t('audit_col_action'),
        cell: ({ row }) => (
          <span className='bg-muted rounded px-1.5 py-0.5 font-mono text-xs'>
            {row.original.action}
          </span>
        ),
      },
      {
        id: 'entity',
        header: t('audit_col_entity'),
        cell: ({ row }) => {
          const entry = row.original
          return (
            <>
              <span className='text-muted-foreground text-xs'>{entry.entity_type}</span>
              {entry.entity_name ? (
                <span className='ml-1'>{entry.entity_name}</span>
              ) : (
                <span className='text-muted-foreground ml-1 font-mono text-xs'>
                  {entry.entity_id}
                </span>
              )}
            </>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const entry = row.original
          const hasBefore = entry.before != null && Object.keys(entry.before as object).length > 0
          const diffs = hasBefore
            ? getDiffs(
                entry.before as Record<string, unknown>,
                entry.after as Record<string, unknown>,
              )
            : []
          if (diffs.length > 0 && !entry.action.endsWith('.created')) {
            return (
              <div className='flex justify-end'>
                <Button
                  variant='outline'
                  className='h-7 px-2 text-xs'
                  onClick={() => {
                    setSelectedEntry(entry)
                    setShowDrawer(true)
                  }}
                >
                  <FileJson className='mr-1 h-3.5 w-3.5' /> Details
                </Button>
              </div>
            )
          }
          return null
        },
      },
    ],
    [t],
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  if (initialLoading) {
    return <SettingsSkeleton rows={8} />
  }

  return (
    <div className='flex flex-col gap-6 p-6'>
      <SectionTitle
        title={t('audit_title')}
        icon={<Shield className='text-muted-foreground h-5 w-5' />}
      />

      {/* Toolbar — sibling above the table (DataTable has no toolbar prop) */}
      <div className='flex flex-wrap gap-3'>
        <select
          className='border-border bg-background h-9 rounded-md border px-3 text-sm focus:ring-indigo-500'
          value={filterEntityType}
          onChange={(e) => {
            const newType = e.target.value
            setFilterEntityType(newType)
            void load(0, false, { entityType: newType })
          }}
        >
          {ENTITY_TYPES.map((t_) => (
            <option key={t_} value={t_}>
              {t_ === '' ? t('audit_filter_all_types') : t_}
            </option>
          ))}
        </select>

        <input
          className='border-border bg-background h-9 rounded-md border px-3 text-sm focus:ring-indigo-500 focus:outline-none'
          placeholder={t('audit_filter_user_placeholder')}
          value={filterUserId}
          onChange={(e) => setFilterUserId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void load(0)
          }}
        />

        <Button className='h-9' onClick={() => void load(0)}>
          {t('audit_filter_apply')}
        </Button>
      </div>

      <DataTable data={entries} columns={columns} />

      {/* Pagination — sibling below the table (DataTable has no pagination prop) */}
      {totalPages > 1 && (
        <div className='border-border flex items-center justify-between border-t pt-4'>
          <p className='text-muted-foreground text-sm'>
            {t('audit_pagination', { page: currentPage, total: totalPages })}
          </p>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              disabled={offset === 0 || loading}
              onClick={() => void load(offset - PAGE_SIZE)}
            >
              {tGlobals('previous')}
            </Button>
            <Button
              variant='outline'
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => void load(offset + PAGE_SIZE)}
            >
              {tGlobals('next')}
            </Button>
          </div>
        </div>
      )}

      {/* Drawer for entry details — always rendered, controlled by showDrawer */}
      <Drawer
        open={showDrawer}
        onOpenChange={setShowDrawer}
        title={t('audit_details_title')}
        headerless
      >
        <div className='flex h-full flex-col'>
          <div className='border-border flex items-center justify-between border-b px-6 py-4'>
            <h2 className='text-lg font-bold text-slate-900 dark:text-white'>
              {t('audit_details_title')}
            </h2>
            <Button
              onClick={() => setShowDrawer(false)}
              variant='outline'
              className='h-8 px-3 text-xs'
            >
              Close
            </Button>
          </div>

          {selectedEntry && (
            <>
              {(() => {
                const diffs = getDiffs(
                  selectedEntry.before as Record<string, unknown>,
                  selectedEntry.after as Record<string, unknown>,
                )
                return (
                  <div className='flex-1 space-y-6 overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950'>
                    <div className='border-border grid grid-cols-2 gap-4 rounded-lg border bg-white p-4 text-sm shadow-sm dark:bg-slate-900'>
                      <div>
                        <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                          Time
                        </p>
                        <p className='mt-0.5 font-medium'>
                          {formatDate(selectedEntry.created_at)}
                        </p>
                      </div>
                      <div>
                        <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                          Action
                        </p>
                        <p className='bg-muted mt-1 w-fit rounded px-1.5 py-0.5 font-mono text-xs'>
                          {selectedEntry.action}
                        </p>
                      </div>
                      <div>
                        <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                          User
                        </p>
                        <p className='mt-0.5 font-medium'>
                          {selectedEntry.user_name || selectedEntry.user_id}
                        </p>
                      </div>
                      <div>
                        <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                          Entity
                        </p>
                        <p className='mt-0.5 font-medium'>
                          <span className='text-muted-foreground mr-1 text-xs'>
                            {selectedEntry.entity_type}
                          </span>
                          {selectedEntry.entity_name || selectedEntry.entity_id}
                        </p>
                      </div>
                    </div>

                    <div className='flex flex-col gap-4'>
                      {diffs.length === 0 ? (
                        <div className='text-muted-foreground border-border rounded-lg border bg-white p-6 text-center dark:bg-slate-900'>
                          {t('audit_details_no_changes')}
                        </div>
                      ) : (
                        diffs.map((diff) => (
                          <div
                            key={diff.key}
                            className='border-border flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-slate-900'
                          >
                            <div className='bg-muted/50 border-border border-b px-3 py-2'>
                              <span className='font-mono text-xs font-semibold text-slate-700 dark:text-slate-300'>
                                {diff.key}
                              </span>
                            </div>
                            <div className='divide-border grid grid-cols-1 divide-y'>
                              {diff.oldVal !== undefined && (
                                <div className='flex items-start gap-3 bg-rose-50/50 p-3 dark:bg-rose-950/20'>
                                  <span className='mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500'></span>
                                  <pre className='m-0 overflow-x-auto font-mono text-xs text-slate-600 line-through opacity-80 dark:text-slate-400'>
                                    {JSON.stringify(diff.oldVal, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {diff.newVal !== undefined && (
                                <div className='flex items-start gap-3 bg-emerald-50/50 p-3 dark:bg-emerald-950/20'>
                                  <span className='mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500'></span>
                                  <pre className='m-0 overflow-x-auto font-mono text-xs text-slate-800 dark:text-slate-200'>
                                    {JSON.stringify(diff.newVal, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </Drawer>
    </div>
  )
}
