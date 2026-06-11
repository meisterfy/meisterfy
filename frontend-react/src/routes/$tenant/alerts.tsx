import { useEffect, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle, LoaderCircle } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  listPendingAdjustments,
  approvePendingAdjustment,
  rejectPendingAdjustment,
  type PendingAdjustment,
} from '@/lib/api/pending-adjustments'

export const Route = createFileRoute('/$tenant/alerts')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: AlertsRoute,
})

function pctDiff(current: number, proposed: number): number {
  if (current === 0) return 0
  return Math.round(Math.abs(((proposed - current) / current) * 100))
}

function badgeLabel(adj: PendingAdjustment): string {
  const pct = pctDiff(adj.current_value, adj.proposed_value)
  switch (adj.adjustment_type) {
    case 'bid_increase':
      return `↑ Bid +${pct}%`
    case 'bid_decrease':
      return `↓ Bid −${pct}%`
    case 'budget_increase':
      return `↑ Budget +${pct}%`
    case 'budget_decrease':
      return `↓ Budget −${pct}%`
  }
}

function isIncrease(adj: PendingAdjustment): boolean {
  return adj.adjustment_type === 'bid_increase' || adj.adjustment_type === 'budget_increase'
}

export function AlertsRoute() {
  const { tenant } = Route.useParams()
  const { t } = useTranslation('ads')

  const [suggestions, setSuggestions] = useState<PendingAdjustment[]>([])
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true
    listPendingAdjustments(tenant, 'pending')
      .then((items) => {
        if (active) setSuggestions(items)
      })
      .catch(() => {
        if (active) setLoadError(true)
      })
    return () => {
      active = false
    }
  }, [tenant])

  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [processingOp, setProcessingOp] = useState<{
    type: 'approve' | 'reject'
    id: string
  } | null>(null)

  function openApprove(id: string) {
    setActiveId(id)
    setApproveDialogOpen(true)
  }
  function openReject(id: string) {
    setActiveId(id)
    setRejectDialogOpen(true)
  }

  async function doApprove() {
    if (!activeId) return
    const id = activeId
    setApproveDialogOpen(false)
    setProcessingOp({ type: 'approve', id })
    try {
      await approvePendingAdjustment(tenant, id)
      setSuggestions((ss) => ss.filter((s) => s.id !== id))
    } catch {
      // leave card in place on failure
    } finally {
      setProcessingOp(null)
    }
  }

  async function doReject() {
    if (!activeId) return
    const id = activeId
    setRejectDialogOpen(false)
    setProcessingOp({ type: 'reject', id })
    try {
      await rejectPendingAdjustment(tenant, id)
      setSuggestions((ss) => ss.filter((s) => s.id !== id))
    } catch {
      // leave card in place on failure
    } finally {
      setProcessingOp(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-full px-4 py-8 sm:px-6 lg:w-[1200px] lg:px-8">
      <h2 className="mb-6 text-xl font-bold text-slate-900 lg:text-2xl dark:text-white">
        {t('alerts.page_title')}
      </h2>

      {loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {t('alerts.error_load')}
        </div>
      ) : suggestions.length > 0 ? (
        <div>
          <h3 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-200">
            {t('alerts.title')}
          </h3>
          <div className="flex flex-col gap-3">
            {suggestions.map((adj) => (
              <div
                key={adj.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    {/* campaign name is not in the response; showing fallback for future improvement */}
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {t('alerts.campaign_adjustment')}
                    </span>
                    <span
                      className={`inline-block w-fit rounded-md px-2 py-0.5 text-xs font-semibold ${
                        isIncrease(adj)
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {badgeLabel(adj)}
                    </span>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{adj.reason}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => openReject(adj.id)}
                      disabled={processingOp !== null}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {processingOp?.id === adj.id && processingOp?.type === 'reject' ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      {t('alerts.ignore')}
                    </button>
                    <button
                      onClick={() => openApprove(adj.id)}
                      disabled={processingOp !== null}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {processingOp?.id === adj.id && processingOp?.type === 'approve' ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                      {t('alerts.approve')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        title={t('alerts.approve_confirm_title')}
        description={t('alerts.approve_confirm_desc')}
        confirmLabel={t('alerts.approve')}
        onConfirm={doApprove}
      />

      <ConfirmDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        title={t('alerts.ignore_confirm_title')}
        description={t('alerts.ignore_confirm_desc')}
        confirmLabel={t('alerts.ignore')}
        onConfirm={doReject}
      />
    </div>
  )
}
