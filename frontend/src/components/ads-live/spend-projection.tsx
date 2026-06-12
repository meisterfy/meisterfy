import { TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DbHistoryDay } from '@/lib/api/campaigns'
import { brl } from '@/lib/utils/format'

function getProjection(days: DbHistoryDay[]) {
  const currentYYYYMM = new Date().toISOString().substring(0, 7)
  const monthRows = days.filter((d) => d.date.startsWith(currentYYYYMM))
  const daysElapsed = monthRows.length
  if (daysElapsed === 0) return null

  const now = new Date()
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate()
  const currentSpend = monthRows.reduce((s, d) => s + d.cost, 0)
  const currentConversions = monthRows.reduce((s, d) => s + d.conversions, 0)
  const projectedSpend = (currentSpend / daysElapsed) * daysInMonth
  const projectedConversions = (currentConversions / daysElapsed) * daysInMonth
  const projectedCpa =
    projectedConversions > 0 ? projectedSpend / projectedConversions : null

  return { projectedSpend, projectedConversions, projectedCpa, daysElapsed }
}

export function SpendProjection({ history }: { history: DbHistoryDay[] }) {
  const { t } = useTranslation('ads')
  const projection = getProjection(history)
  if (!projection) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-indigo-500" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('analytics.projection_title')}
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {t('analytics.projected_spend')}
          </p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            {brl(projection.projectedSpend)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {t('analytics.projected_conversions')}
          </p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            {projection.projectedConversions.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {t('analytics.projected_cpa')}
          </p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            {projection.projectedCpa !== null
              ? brl(projection.projectedCpa)
              : '—'}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {t('analytics.based_on_days', { days: projection.daysElapsed })}
      </p>
    </div>
  )
}
