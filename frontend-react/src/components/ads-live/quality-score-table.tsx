import { useTranslation } from 'react-i18next'
import type { KeywordQSRow } from '@/lib/api/campaigns'

function signalDot(value: string) {
  if (value === 'BELOW_AVERAGE') return 'bg-red-500'
  if (value === 'ABOVE_AVERAGE') return 'bg-green-500'
  if (value === 'AVERAGE') return 'bg-amber-400'
  return 'bg-slate-300 dark:bg-slate-600'
}

export function QualityScoreTable({ keywords }: { keywords: KeywordQSRow[] }) {
  const { t } = useTranslation('ads')

  const sorted = [...keywords].sort((a, b) => a.qualityScore - b.qualityScore)
  const lowQsCount = keywords.filter((k) => k.qualityScore > 0 && k.qualityScore < 5).length

  function qsBadge(qs: number) {
    if (qs === 0)
      return {
        label: t('analytics.quality_score_qs_na'),
        cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
      }
    if (qs <= 4)
      return {
        label: t('analytics.quality_score_qs_poor'),
        cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      }
    if (qs <= 7)
      return {
        label: t('analytics.quality_score_qs_ok'),
        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      }
    return {
      label: t('analytics.quality_score_qs_good'),
      cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    }
  }

  function matchTypeLabel(mt: string) {
    if (mt === 'BROAD') return t('analytics.match_broad')
    if (mt === 'PHRASE') return t('analytics.match_phrase')
    if (mt === 'EXACT') return t('analytics.match_exact')
    return mt
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white p-4 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {t('analytics.quality_score_title')}
      </h3>

      {keywords.length === 0 ? (
        <p className="text-sm text-slate-400">{t('analytics.quality_score_empty')}</p>
      ) : (
        <>
          {lowQsCount > 0 && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              {t('analytics.quality_score_action_needed', { count: lowQsCount })}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-500">
                  <th className="pr-3 pb-1 font-medium">{t('analytics.kw_keyword')}</th>
                  <th className="pr-3 pb-1 font-medium">{t('analytics.kw_match')}</th>
                  <th className="pr-3 pb-1 font-medium">{t('analytics.kw_adgroup')}</th>
                  <th className="pr-3 pb-1 text-center font-medium">QS</th>
                  <th className="pr-3 pb-1 text-center font-medium">Creative</th>
                  <th className="pr-3 pb-1 text-center font-medium">{t('analytics.landing_page')}</th>
                  <th className="pb-1 text-center font-medium">{t('analytics.pred_ctr')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((kw) => {
                  const badge = qsBadge(kw.qualityScore)
                  return (
                    <tr
                      key={`${kw.keywordText}|${kw.matchType}|${kw.adGroupName}`}
                      className="border-b border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="max-w-[180px] truncate py-1.5 pr-3 text-slate-700 dark:text-slate-200">
                        {kw.keywordText}
                      </td>
                      <td className="py-1.5 pr-3 text-slate-500">{matchTypeLabel(kw.matchType)}</td>
                      <td className="max-w-[120px] truncate py-1.5 pr-3 text-slate-500">
                        {kw.adGroupName}
                      </td>
                      <td className="py-1.5 pr-3 text-center">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}
                        >
                          {kw.qualityScore > 0 ? kw.qualityScore : ''}
                          {kw.qualityScore > 0 ? ' · ' : ''}
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-center">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${signalDot(kw.creativeQS)}`}
                        ></span>
                      </td>
                      <td className="py-1.5 pr-3 text-center">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${signalDot(kw.postClickQS)}`}
                        ></span>
                      </td>
                      <td className="py-1.5 text-center">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${signalDot(kw.predictedCTR)}`}
                        ></span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
