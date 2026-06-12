import { Flame } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DbHistoryDay } from '@/lib/api/campaigns'
import { brl } from '@/lib/utils/format'

function getExtremes(days: DbHistoryDay[]) {
  const withConversions = days.filter((d) => d.conversions > 0)
  if (withConversions.length < 10) return null

  const sorted = [...withConversions].sort((a, b) => a.cpa - b.cpa)
  const best = sorted.slice(0, 5)
  const worst = sorted.slice(-5).reverse()

  let maxStreak = 0
  let curStreak = 0
  for (const d of days) {
    if (d.conversions === 0) {
      curStreak++
      if (curStreak > maxStreak) maxStreak = curStreak
    } else {
      curStreak = 0
    }
  }

  return { best, worst, maxStreak }
}

function ddmm(date: string): string {
  return date.slice(8, 10) + '/' + date.slice(5, 7)
}

export function PerformanceExtremes({ history }: { history: DbHistoryDay[] }) {
  const { t } = useTranslation('ads')
  const extremes = getExtremes(history)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex items-center gap-2">
        <Flame className="h-5 w-5 text-indigo-500" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('analytics.extremes_title')}
        </h3>
      </div>

      {!extremes ? (
        <p className="py-4 text-center text-sm text-slate-400">
          {t('analytics.no_conversion_data')}
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-6">
            <div>
              <p className="mb-3 text-xs font-semibold tracking-wide text-emerald-600 uppercase">
                {t('analytics.best_days')}
              </p>
              {extremes.best.map((d) => (
                <div
                  key={d.date}
                  className="flex justify-between border-b border-slate-50 py-1.5 text-sm dark:border-slate-800"
                >
                  <span className="text-slate-500">{ddmm(d.date)}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {brl(d.cpa)}
                  </span>
                  <span className="text-slate-400">
                    {d.conversions} {t('analytics.conv_abbrev')}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold tracking-wide text-red-500 uppercase">
                {t('analytics.worst_days')}
              </p>
              {extremes.worst.map((d) => (
                <div
                  key={d.date}
                  className="flex justify-between border-b border-slate-50 py-1.5 text-sm dark:border-slate-800"
                >
                  <span className="text-slate-500">{ddmm(d.date)}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {brl(d.cpa)}
                  </span>
                  <span className="text-slate-400">
                    {d.conversions} {t('analytics.conv_abbrev')}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {extremes.maxStreak > 0 && (
            <p className="text-center text-xs text-slate-400">
              {t('analytics.dry_streak', { days: extremes.maxStreak })}
            </p>
          )}
        </>
      )}
    </div>
  )
}
