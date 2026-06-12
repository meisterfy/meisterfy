import { Target, DollarSign, Activity, MousePointerClick, Percent, CreditCard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  isSmartManaged,
  type LiveCampaignDetail,
  type DeviceRow,
  type HourlyRow,
  type ImpressionShareStats,
} from '@/lib/api/campaigns'
import { wowDelta } from '@/lib/utils/metrics'
import { brl } from '@/lib/utils/format'
import { createPerformanceTimelineConfig } from '@/lib/utils/charts'
import { MetricCard } from '@/components/ads/metric-card'
import { PerformanceChart } from '@/components/ads/performance-chart'
import { AlertBanner } from './alert-banner'
import { AdsGroupsList } from './ads-groups-list'
import { BudgetPacingCard } from './budget-pacing-card'
import { Loading } from './loading'
import { ImpressionShareCard } from './impression-share-card'
import { DeviceBreakdown } from './device-breakdown'
import { HourlyHeatmap } from './hourly-heatmap'

function getDeltas(d: LiveCampaignDetail) {
  const curCvr = d.wow.cur.clicks > 0 ? d.wow.cur.conversions / d.wow.cur.clicks : 0
  const prevCvr = d.wow.prev.clicks > 0 ? d.wow.prev.conversions / d.wow.prev.clicks : 0
  const curCpc = d.wow.cur.clicks > 0 ? d.wow.cur.cost / d.wow.cur.clicks : 0
  const prevCpc = d.wow.prev.clicks > 0 ? d.wow.prev.cost / d.wow.prev.clicks : 0
  return {
    impressions: wowDelta(d.wow.cur.impressions, d.wow.prev.impressions),
    clicks: wowDelta(d.wow.cur.clicks, d.wow.prev.clicks),
    cost: wowDelta(d.wow.cur.cost, d.wow.prev.cost, true),
    conversions: wowDelta(d.wow.cur.conversions, d.wow.prev.conversions),
    cvr: wowDelta(curCvr, prevCvr),
    cpc: wowDelta(curCpc, prevCpc, true),
  }
}

export function LiveTab({
  detail,
  isLoadingPeriod,
  onSetPeriod,
  onClearPeriod,
  devices,
  hourly,
  impressionShare,
}: {
  detail: LiveCampaignDetail | null
  isLoadingPeriod: boolean
  onSetPeriod: (days: number) => void
  onClearPeriod: () => void
  devices: DeviceRow[]
  hourly: HourlyRow[]
  impressionShare: ImpressionShareStats | null
}) {
  const { t } = useTranslation('ads')

  const periods = [
    { label: t('analytics.period_7d'), days: 7 },
    { label: t('analytics.period_14d'), days: 14 },
    { label: t('analytics.period_30d'), days: 30 },
  ]

  return (
    <div
      className={`relative space-y-6 py-6 ${isLoadingPeriod ? 'pointer-events-none opacity-50' : ''}`}
    >
      {isLoadingPeriod && <Loading />}

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {t('period')}:
        </span>
        {periods.map(({ label, days }) => (
          <button
            key={days}
            type="button"
            onClick={() => onSetPeriod(days)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClearPeriod}
          className="text-xs font-medium text-slate-400 underline-offset-2 hover:underline dark:text-slate-500"
        >
          {t('all_time')}
        </button>
      </div>

      {!detail ? (
        <div className="grid animate-pulse grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : (
        <LiveContent
          d={detail}
          devices={devices}
          hourly={hourly}
          impressionShare={impressionShare}
        />
      )}
    </div>
  )
}

function LiveContent({
  d,
  devices,
  hourly,
  impressionShare,
}: {
  d: LiveCampaignDetail
  devices: DeviceRow[]
  hourly: HourlyRow[]
  impressionShare: ImpressionShareStats | null
}) {
  const { t } = useTranslation('ads')
  const deltas = getDeltas(d)
  const m = d.campaign.metrics
  const cvrValue =
    d.wow.cur.clicks > 0 ? ((d.wow.cur.conversions / d.wow.cur.clicks) * 100).toFixed(2) + '%' : '—'
  const cpcValue = d.wow.cur.clicks > 0 ? brl(d.wow.cur.cost / d.wow.cur.clicks) : '—'

  return (
    <>
      {d.openAlerts.length > 0 && <AlertBanner data={{ openAlerts: d.openAlerts }} />}
      {d.budgetPacing && <BudgetPacingCard pacing={d.budgetPacing} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          icon={Activity}
          theme="indigo"
          label={t('impressions')}
          value={m.impressions}
          subtitle={`${t('share')}: ${m.searchImpressionShare}`}
          delta={deltas.impressions}
        />
        <MetricCard
          icon={MousePointerClick}
          theme="blue"
          label={t('clicks')}
          value={m.clicks}
          subtitle={`${t('ctr')}: ${m.ctr}`}
          delta={deltas.clicks}
        />
        <MetricCard
          icon={DollarSign}
          theme="emerald"
          label={t('total_cost')}
          value={m.cost}
          delta={deltas.cost}
        />
        <MetricCard
          icon={Target}
          theme="amber"
          label={t('conversions')}
          value={m.conversions}
          subtitle={`${t('cpa')}: ${m.cpa}`}
          delta={deltas.conversions}
        />
        <MetricCard icon={Percent} theme="rose" label={t('cvr')} value={cvrValue} delta={deltas.cvr} />
        <MetricCard
          icon={CreditCard}
          theme="slate"
          label={t('cpc')}
          value={cpcValue}
          delta={deltas.cpc}
        />
      </div>

      {d.campaign.history.length > 0 && (
        <PerformanceChart
          config={createPerformanceTimelineConfig(
            d.campaign.history,
            t as unknown as (k: string) => string,
          )}
          title={t('graph.performance_timeline')}
          source={t('graph.source', { source: 'Google Ads API' })}
          icon={Activity}
        />
      )}

      {!isSmartManaged(d.campaign.adGroups) && <AdsGroupsList adGroups={d.campaign.adGroups} />}

      <ImpressionShareCard stats={impressionShare} />
      <DeviceBreakdown devices={devices} />
      <HourlyHeatmap hourly={hourly} />
    </>
  )
}
