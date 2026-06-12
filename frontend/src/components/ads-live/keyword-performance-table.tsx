import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { brl } from '@/lib/utils/format'
import type { KeywordPerfRow } from '@/lib/api/campaigns'

type SortKey = keyof KeywordPerfRow

function matchBadge(mt: string) {
  if (mt === 'BROAD') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  if (mt === 'PHRASE') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
  if (mt === 'EXACT')
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  return 'bg-slate-100 text-slate-500'
}

export function KeywordPerformanceTable({ keywords }: { keywords: KeywordPerfRow[] }) {
  const { t } = useTranslation('ads')
  const [sortKey, setSortKey] = useState<SortKey>('cost')
  const [sortAsc, setSortAsc] = useState(false)
  const [filter, setFilter] = useState('')

  const filtered = filter.trim()
    ? keywords.filter((k) => k.keywordText.toLowerCase().includes(filter.toLowerCase()))
    : keywords

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortAsc ? av - bv : bv - av
    }
    return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
  })

  function setSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return ''
    return sortAsc ? ' ↑' : ' ↓'
  }

  function matchLabel(mt: string) {
    if (mt === 'BROAD') return t('analytics.match_broad')
    if (mt === 'PHRASE') return t('analytics.match_phrase')
    if (mt === 'EXACT') return t('analytics.match_exact')
    return mt
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white p-4 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('analytics.keywords_title')}
        </h3>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('analytics.keywords_filter_placeholder')}
          className="w-48 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 placeholder-slate-400 focus:ring-1 focus:ring-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:placeholder-slate-500"
        />
      </div>

      {keywords.length === 0 ? (
        <p className="text-sm text-slate-400">{t('analytics.keywords_empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-left text-slate-500">
                <th
                  className="cursor-pointer pr-3 pb-1 font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={() => setSort('keywordText')}
                >
                  {t('analytics.kw_keyword')}
                  {sortIcon('keywordText')}
                </th>
                <th className="pr-3 pb-1 font-medium">{t('analytics.kw_match')}</th>
                <th className="pr-3 pb-1 font-medium">{t('analytics.kw_adgroup')}</th>
                <th
                  className="cursor-pointer pr-3 pb-1 text-right font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={() => setSort('clicks')}
                >
                  {t('clicks')}
                  {sortIcon('clicks')}
                </th>
                <th
                  className="cursor-pointer pr-3 pb-1 text-right font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={() => setSort('impressions')}
                >
                  {t('analytics.kw_impr')}
                  {sortIcon('impressions')}
                </th>
                <th
                  className="cursor-pointer pr-3 pb-1 text-right font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={() => setSort('cost')}
                >
                  {t('analytics.kw_cost')}
                  {sortIcon('cost')}
                </th>
                <th
                  className="cursor-pointer pr-3 pb-1 text-right font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={() => setSort('conversions')}
                >
                  {t('analytics.kw_conv')}
                  {sortIcon('conversions')}
                </th>
                <th
                  className="cursor-pointer pr-3 pb-1 text-right font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={() => setSort('cpa')}
                >
                  {t('cpa')}
                  {sortIcon('cpa')}
                </th>
                <th
                  className="cursor-pointer pb-1 text-right font-medium select-none hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={() => setSort('ctr')}
                >
                  {t('ctr')}
                  {sortIcon('ctr')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((kw) => (
                <tr
                  key={`${kw.keywordText}|${kw.matchType}|${kw.adGroupName}`}
                  className="border-b border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="max-w-[180px] truncate py-1.5 pr-3 text-slate-700 dark:text-slate-200">
                    {kw.keywordText}
                  </td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${matchBadge(kw.matchType)}`}
                    >
                      {matchLabel(kw.matchType)}
                    </span>
                  </td>
                  <td className="max-w-[120px] truncate py-1.5 pr-3 text-slate-500">
                    {kw.adGroupName}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{kw.clicks}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{kw.impressions}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{brl(kw.cost)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{kw.conversions}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {kw.cpa > 0 ? brl(kw.cpa) : '—'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{kw.ctr.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
