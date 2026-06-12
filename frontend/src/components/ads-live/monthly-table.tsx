import { useTranslation } from 'react-i18next'
import { brl } from '@/lib/utils/format'
import type { DbHistoryDay } from '@/lib/api/campaigns'

interface MonthRow {
  month: string
  cost: number
  conversions: number
  clicks: number
  impressions: number
  cpa: number | null
  ctr: number | null
  activeDays: number
}

function groupByMonth(days: DbHistoryDay[]): MonthRow[] {
  const map = new Map<string, MonthRow>()
  for (const d of days) {
    const month = d.date.substring(0, 7)
    if (!map.has(month)) {
      map.set(month, {
        month,
        cost: 0,
        conversions: 0,
        clicks: 0,
        impressions: 0,
        cpa: null,
        ctr: null,
        activeDays: 0,
      })
    }
    const row = map.get(month)!
    row.cost += d.cost
    row.conversions += d.conversions
    row.clicks += d.clicks
    row.impressions += d.impressions
    if (d.impressions > 0) row.activeDays++
  }
  const rows = Array.from(map.values())
  for (const r of rows) {
    r.cpa = r.conversions > 0 ? r.cost / r.conversions : null
    r.ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null
  }
  return rows.sort((a, b) => b.month.localeCompare(a.month))
}

function trend(
  cur: number | null,
  prev: number | null,
  lowerIsBetter = false,
): 'up' | 'down' | null {
  if (cur === null || prev === null || cur === prev) return null
  const improved = lowerIsBetter ? cur < prev : cur > prev
  return improved ? 'up' : 'down'
}

export function MonthlyTable({ history }: { history: DbHistoryDay[] }) {
  const { t } = useTranslation('ads')
  const rows = groupByMonth(history)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-6 text-lg font-bold text-slate-900 dark:text-white">
        {t('analytics.monthly_title')}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:border-slate-800">
              <th className="pb-2 text-left">{t('analytics.month')}</th>
              <th className="pb-2 text-right">{t('total_cost')}</th>
              <th className="pb-2 text-right">{t('conversions')}</th>
              <th className="pb-2 text-right">{t('cpa')} △</th>
              <th className="pb-2 text-right">{t('ctr')}</th>
              <th className="pb-2 text-right">{t('labels.active_days')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const prev = rows[i + 1]
              const cpaTrend = prev ? trend(row.cpa, prev.cpa, true) : null
              const convTrend = prev ? trend(row.conversions, prev.conversions) : null
              return (
                <tr key={row.month} className="border-b border-slate-50 dark:border-slate-800/50">
                  <td className="py-2 font-medium text-slate-700 dark:text-slate-300">
                    {row.month}
                  </td>
                  <td className="py-2 text-right text-slate-700 dark:text-slate-300">
                    {brl(row.cost)}
                  </td>
                  <td className="py-2 text-right text-slate-700 dark:text-slate-300">
                    {row.conversions}{' '}
                    {convTrend === 'up' ? (
                      <span className="text-emerald-500">↑</span>
                    ) : convTrend === 'down' ? (
                      <span className="text-red-500">↓</span>
                    ) : null}
                  </td>
                  <td className="py-2 text-right text-slate-700 dark:text-slate-300">
                    {row.cpa !== null ? brl(row.cpa) : '—'}{' '}
                    {cpaTrend === 'up' ? (
                      <span className="text-emerald-500">↑</span>
                    ) : cpaTrend === 'down' ? (
                      <span className="text-red-500">↓</span>
                    ) : null}
                  </td>
                  <td className="py-2 text-right text-slate-700 dark:text-slate-300">
                    {row.ctr !== null ? row.ctr.toFixed(2) + '%' : '—'}
                  </td>
                  <td className="py-2 text-right text-slate-700 dark:text-slate-300">
                    {row.activeDays}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
