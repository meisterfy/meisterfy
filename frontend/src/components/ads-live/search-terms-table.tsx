import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { brl } from '@/lib/utils/format'
import type { SearchTermRow } from '@/lib/api/campaigns'

function statusBadge(status: string) {
  if (status === 'EXCLUDED')
    return {
      label: 'Negative',
      cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    }
  if (status === 'ADDED')
    return {
      label: 'Keyword',
      cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    }
  return null
}

export function SearchTermsTable({ terms }: { terms: SearchTermRow[] }) {
  const { t } = useTranslation('ads')

  const avgCost =
    terms.length > 0 ? terms.reduce((s, term) => s + term.cost, 0) / terms.length : 0

  const converting = [...terms.filter((term) => term.conversions > 0)].sort(
    (a, b) => b.conversions - a.conversions,
  )

  const wasted = [...terms.filter((term) => term.conversions === 0 && term.cost > avgCost)]
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 20)

  const [copyLabel, setCopyLabel] = useState(t('analytics.search_terms_copy_csv'))
  const [fallbackCsv, setFallbackCsv] = useState<string | null>(null)

  function buildCsv(): string {
    const rows = wasted.map((term) => `"${term.term.replace(/"/g, '""')}",${brl(term.cost)},${term.clicks}`)
    return ['Term,Cost,Clicks', ...rows].join('\n')
  }

  async function copyAsCsv() {
    const csv = buildCsv()
    try {
      await navigator.clipboard.writeText(csv)
      setCopyLabel(t('analytics.search_terms_copied'))
      setTimeout(() => setCopyLabel(t('analytics.search_terms_copy_csv')), 2000)
    } catch {
      setFallbackCsv(csv)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white p-4 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {t('analytics.search_terms_title')}
      </h3>

      {terms.length === 0 ? (
        <p className="text-sm text-slate-400">{t('analytics.search_terms_empty')}</p>
      ) : (
        <>
          {converting.length > 0 && (
            <section className="space-y-2">
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t('analytics.search_terms_converting')}
                </p>
                <p className="text-xs text-slate-400">
                  {t('analytics.search_terms_converting_hint')}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-slate-500">
                      <th className="pr-3 pb-1 font-medium">{t('analytics.search_term')}</th>
                      <th className="pr-3 pb-1 text-right font-medium">Clicks</th>
                      <th className="pr-3 pb-1 text-right font-medium">{t('analytics.kw_conv')}</th>
                      <th className="pr-3 pb-1 text-right font-medium">Cost</th>
                      <th className="pr-3 pb-1 text-right font-medium">CPA</th>
                      <th className="pr-3 pb-1 text-right font-medium">CTR</th>
                      <th className="pb-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {converting.map((term) => {
                      const badge = statusBadge(term.status)
                      return (
                        <tr
                          key={term.term}
                          className="border-b border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="max-w-[200px] truncate py-1.5 pr-3 text-slate-700 dark:text-slate-200">
                            {term.term}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{term.clicks}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{term.conversions}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{brl(term.cost)}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {term.cpa > 0 ? brl(term.cpa) : '—'}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {term.ctr.toFixed(1)}%
                          </td>
                          <td className="py-1.5">
                            {badge && (
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}
                              >
                                {badge.label}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {wasted.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t('analytics.search_terms_wasted')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {t('analytics.search_terms_wasted_hint')}
                  </p>
                </div>
                <button
                  onClick={copyAsCsv}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {copyLabel}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-slate-500">
                      <th className="pr-3 pb-1 font-medium">{t('analytics.search_term')}</th>
                      <th className="pr-3 pb-1 text-right font-medium">Clicks</th>
                      <th className="pr-3 pb-1 text-right font-medium">{t('analytics.kw_conv')}</th>
                      <th className="pr-3 pb-1 text-right font-medium">Cost</th>
                      <th className="pr-3 pb-1 text-right font-medium">CTR</th>
                      <th className="pb-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wasted.map((term) => {
                      const badge = statusBadge(term.status)
                      return (
                        <tr
                          key={term.term}
                          className="border-b border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="max-w-[200px] truncate py-1.5 pr-3 text-slate-700 dark:text-slate-200">
                            {term.term}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{term.clicks}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">0</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{brl(term.cost)}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {term.ctr.toFixed(1)}%
                          </td>
                          <td className="py-1.5">
                            {badge && (
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}
                              >
                                {badge.label}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {fallbackCsv !== null && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    {t('analytics.search_terms_copy_fallback')}
                  </p>
                  <textarea
                    readOnly
                    rows={5}
                    value={fallbackCsv}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
