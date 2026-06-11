import { useTranslation } from 'react-i18next'
import { ChartColumnIncreasing } from 'lucide-react'
import type { AdGroup } from '@/lib/api/campaigns'

export function AdsGroupsList({ adGroups = [] }: { adGroups?: AdGroup[] }) {
  const { t } = useTranslation('ads')

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-5 dark:border-slate-800 dark:bg-slate-800/20">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <ChartColumnIncreasing className="h-5 w-5 text-indigo-500" />
          {t('ad_groups_breakdown')}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-6 py-4">{t('ad_groups')}</th>
              <th className="px-6 py-4">{t('status')}</th>
              <th className="px-6 py-4 text-right">{t('impressions')}</th>
              <th className="px-6 py-4 text-right">{t('clicks')}</th>
              <th className="px-6 py-4 text-right">{t('total_cost')}</th>
              <th className="px-6 py-4 text-right">{t('conversions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {adGroups.map((group) => (
              <tr
                key={group.name}
                className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                  {group.name}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                      group.status === 'ENABLED'
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {group.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-400">
                  {group.metrics.impressions}
                </td>
                <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-400">
                  {group.metrics.clicks}
                </td>
                <td className="px-6 py-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  {group.metrics.cost}
                </td>
                <td className="px-6 py-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                  {group.metrics.conversions}
                </td>
              </tr>
            ))}
            {adGroups.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  {t('messages.no_ad_groups_found')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
