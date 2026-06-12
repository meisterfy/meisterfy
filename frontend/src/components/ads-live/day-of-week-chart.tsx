import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import { BarChart2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DbHistoryDay } from '@/lib/api/campaigns'
import { createDayOfWeekCostConfig, createDayOfWeekCpaConfig } from '@/lib/utils/charts'

function aggregateByDow(days: DbHistoryDay[]) {
  const totals = Array.from({ length: 7 }, () => ({
    cost: 0,
    conversions: 0,
    impressions: 0,
    days: 0,
  }))
  for (const d of days) {
    if (d.impressions > 0) {
      const dow = new Date(d.date + 'T12:00:00').getDay()
      totals[dow].cost += d.cost
      totals[dow].conversions += d.conversions
      totals[dow].impressions += d.impressions
      totals[dow].days++
    }
  }
  return {
    avgCosts: totals.map((t) => (t.days > 0 ? t.cost / t.days : 0)),
    avgCpas: totals.map((t) => (t.conversions > 0 ? t.cost / t.conversions : null)) as (
      | number
      | null
    )[],
  }
}

export function DayOfWeekChart({ history }: { history: DbHistoryDay[] }) {
  const { t } = useTranslation('ads')

  const hasEnoughData = history.length >= 14
  const agg = useMemo(() => aggregateByDow(history), [history])
  // charts.ts builders take a plain (key) => string; bridge the typed-i18n t
  // (which only accepts known keys as literals) with a localized cast.
  const costConfig = useMemo(
    () => createDayOfWeekCostConfig(agg.avgCosts, t as unknown as (k: string) => string),
    [agg.avgCosts, t],
  )
  const cpaConfig = useMemo(
    () => createDayOfWeekCpaConfig(agg.avgCpas, t as unknown as (k: string) => string),
    [agg.avgCpas, t],
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-indigo-500" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('analytics.dow_title')}
        </h3>
      </div>
      <p className="mb-6 ml-7 text-xs text-slate-400">{t('analytics.dow_subtitle')}</p>

      {!hasEnoughData ? (
        <p className="py-8 text-center text-sm text-slate-400">{t('analytics.dow_min_data')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
              {t('analytics.dow_avg_cost')}
            </p>
            <div className="h-[220px] w-full">
              <Bar data={costConfig.data} options={costConfig.options} />
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
              {t('analytics.dow_avg_cpa')}
            </p>
            <div className="h-[220px] w-full">
              <Bar data={cpaConfig.data} options={cpaConfig.options} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
