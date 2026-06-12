import { useMemo } from 'react'
import { Chart } from 'react-chartjs-2'
import { ChartColumnIncreasing } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChartData, ChartOptions } from 'chart.js'
import type { DbHistoryDay } from '@/lib/api/campaigns'
import { createDailyCostCpaConfig } from '@/lib/utils/charts'
import { MonthlyTable } from './monthly-table'
import { MonthlyMetricsGrid } from './monthly-metrics-grid'
import { DayOfWeekChart } from './day-of-week-chart'
import { SpendProjection } from './spend-projection'
import { PerformanceExtremes } from './performance-extremes'

function getMonthlySummary(history: DbHistoryDay[]) {
  const currentMonth = new Date().toISOString().substring(0, 7)
  const monthRows = history.filter((d) => d.date.startsWith(currentMonth))
  if (monthRows.length === 0) return null

  const totalConv = monthRows.reduce((s, d) => s + d.conversions, 0)
  const totalCost = monthRows.reduce((s, d) => s + d.cost, 0)

  return {
    totalCost,
    totalConversions: totalConv,
    daysActive: monthRows.filter((d) => d.impressions > 0).length,
    avgCpa: totalConv > 0 ? totalCost / totalConv : 0,
  }
}

export function HistoryTab({ history }: { history: DbHistoryDay[] }) {
  const { t } = useTranslation('ads')

  const monthly = useMemo(() => getMonthlySummary(history), [history])
  // charts.ts builder takes a plain (key) => string; bridge the typed-i18n t.
  const cfg = useMemo(
    () => createDailyCostCpaConfig(history, t as unknown as (k: string) => string),
    [history, t],
  )

  if (history.length === 0) return <div className="space-y-6 py-6" />

  return (
    <div className="space-y-6 py-6">
      <SpendProjection history={history} />
      <MonthlyTable history={history} />

      {monthly && <MonthlyMetricsGrid metrics={monthly} />}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <ChartColumnIncreasing className="h-5 w-5 text-indigo-500" />
          {t('graph.daily_cost_cpa')}
          <span className="ml-auto text-xs font-normal text-slate-400">
            {t('graph.source', { source: 'Local monitoring' })}
          </span>
        </h3>
        <p className="mb-5 ml-7 text-xs text-slate-400">
          {t('graph.cpa_only_on_days_with_conversions')}
        </p>
        <div className="h-[280px] w-full">
          <Chart
            type="bar"
            data={cfg.data as ChartData<'bar'>}
            options={cfg.options as ChartOptions<'bar'>}
          />
        </div>
      </div>

      <DayOfWeekChart history={history} />
      <PerformanceExtremes history={history} />
    </div>
  )
}
