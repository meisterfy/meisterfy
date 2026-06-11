import { useTranslation } from 'react-i18next'
import type { ImpressionShareStats } from '@/lib/api/campaigns'

export function ImpressionShareCard({
  stats,
}: {
  stats: ImpressionShareStats | null
}) {
  const { t } = useTranslation('ads')
  if (!stats) return null

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {t('analytics.impression_share_title')}
      </h3>

      <div className="flex h-6 w-full overflow-hidden rounded-full">
        <div
          className="bg-emerald-500 transition-all"
          style={{ width: `${(stats.wonShare * 100).toFixed(1)}%` }}
          title={t('analytics.impression_share_won')}
        />
        <div
          className="bg-amber-400 transition-all"
          style={{ width: `${(stats.lostBudget * 100).toFixed(1)}%` }}
          title={t('analytics.impression_share_lost_budget')}
        />
        <div
          className="bg-red-400 transition-all"
          style={{ width: `${(stats.lostRank * 100).toFixed(1)}%` }}
          title={t('analytics.impression_share_lost_rank')}
        />
      </div>

      <div className="flex gap-6 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-slate-600 dark:text-slate-300">
            {t('analytics.impression_share_won')}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {(stats.wonShare * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
          <span className="text-slate-600 dark:text-slate-300">
            {t('analytics.impression_share_lost_budget')}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {(stats.lostBudget * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-400" />
          <span className="text-slate-600 dark:text-slate-300">
            {t('analytics.impression_share_lost_rank')}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {(stats.lostRank * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {stats.lostBudget > 0.15 && (
        <div className="rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {t('analytics.impression_share_budget_warning')}
        </div>
      )}
      {stats.lostRank > 0.15 && (
        <div className="rounded-lg border border-red-300/40 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
          {t('analytics.impression_share_rank_warning')}
        </div>
      )}
    </div>
  )
}
