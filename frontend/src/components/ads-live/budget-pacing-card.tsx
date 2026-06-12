import { Gauge } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { brl } from '@/lib/utils/format'

function pacingColor(pct: number): string {
  if (pct > 0.9) return 'bg-emerald-500'
  if (pct > 0.5) return 'bg-amber-400'
  return 'bg-red-400'
}

export function BudgetPacingCard({
  pacing,
}: {
  pacing: { date: string; cost: number; budget: number; pct: number }
}) {
  const { t } = useTranslation('ads')
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800">
          <Gauge className="h-4 w-4" />
        </div>
        {t('analytics.budget_pacing_title')} —
        <span className="font-mono text-xs">{pacing.date}</span>
      </div>
      <div className="mb-2 flex items-end justify-between">
        <span className="text-2xl font-bold text-slate-900 dark:text-white">
          {brl(pacing.cost)}
        </span>
        <span className="text-sm text-slate-500">
          {t('analytics.budget_pacing_of')} {brl(pacing.budget)}/day
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-2 rounded-full transition-all ${pacingColor(pacing.pct)}`}
          style={{ width: `${Math.min(pacing.pct * 100, 100).toFixed(0)}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-xs text-slate-400">
        {(pacing.pct * 100).toFixed(0)}% {t('analytics.budget_pacing_used')}
      </p>
    </div>
  )
}
