import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { brl } from '@/lib/utils/format'

export function MonthlyMetricsGrid({
  metrics,
}: {
  metrics: {
    totalCost: number
    totalConversions: number
    daysActive: number
    avgCpa: number
  }
}) {
  const { t } = useTranslation('ads')
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800">
          <CalendarDays className="h-4 w-4" />
        </div>
        {t('dates.month_to_date')}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {t('total_cost')}
          </p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            {brl(metrics.totalCost)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {t('conversions')}
          </p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            {metrics.totalConversions}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {t('labels.active_days')}
          </p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            {metrics.daysActive}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {t('cpa')}
          </p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            {metrics.avgCpa > 0 ? brl(metrics.avgCpa) : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}
