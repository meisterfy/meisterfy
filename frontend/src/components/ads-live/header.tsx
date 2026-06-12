import { Link } from '@tanstack/react-router'
import { ArrowLeft, Download, Target, Play, Pause, RefreshCw, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LiveCampaignDetail } from '@/lib/api/campaigns'

export interface CampaignActions {
  syncing: boolean
  exporting: boolean
  runSyncHistory: (tenant: string) => void
  exportReport: (campaignId: string, clientId: string) => void
}

const STRATEGY_KEYS: Record<string, string> = {
  TARGET_SPEND: 'strategies.target_spend',
  TARGET_CPA: 'strategies.target_cpa',
  MAXIMIZE_CONVERSIONS: 'strategies.maximize_conversions',
  MAXIMIZE_CONVERSION_VALUE: 'strategies.maximize_conversion_value',
  TARGET_ROAS: 'strategies.target_roas',
  MANUAL_CPC: 'strategies.manual_cpc',
  ENHANCED_CPC: 'strategies.enhanced_cpc',
  TARGET_IMPRESSION_SHARE: 'strategies.target_impression_share',
}

function formatStrategy(strategy: string, t: (key: string) => string) {
  const key = STRATEGY_KEYS[strategy]
  if (key) return t(key)
  return strategy
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

export function LiveHeader({
  detail,
  tenant,
  campaignId,
  actions,
}: {
  detail: LiveCampaignDetail | null
  tenant: string
  campaignId: string
  actions: CampaignActions
}) {
  const { t } = useTranslation('ads')

  return (
    <div className="flex flex-col items-end justify-between gap-2 border-b border-white/10 pb-4 lg:flex-row">
      <div className="flex flex-col items-start justify-start gap-2 lg:gap-4">
        <Link
          to="/$tenant/ads/google"
          params={{ tenant }}
          className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl dark:text-white">
          {detail?.campaign.name ?? 'Campaign'}
        </h1>
        <div className="flex items-start justify-start gap-2 lg:gap-4">
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500 dark:bg-slate-800">
            ID: {detail?.campaign.id ?? campaignId}
          </span>
          {detail && (
            <>
              <span
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                  detail.campaign.status === 'ENABLED'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {detail.campaign.status === 'ENABLED' ? (
                  <>
                    <Play className="h-3 w-3" /> {t('status.active')}
                  </>
                ) : (
                  <>
                    <Pause className="h-3 w-3" /> {t('status.paused')}
                  </>
                )}
              </span>
              <p className="flex items-center gap-1 text-sm text-slate-500">
                <Target className="h-4 w-4" />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatStrategy(detail.campaign.strategy, t as unknown as (key: string) => string)}
                </span>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => actions.runSyncHistory(tenant)}
          disabled={actions.syncing}
          className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {actions.syncing ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" /> {t('syncing')}
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" /> {t('sync')}
            </>
          )}
        </button>
        <button
          onClick={() => detail && actions.exportReport(detail.campaign.id, detail.client.id)}
          disabled={actions.exporting || !detail}
          className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {actions.exporting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" /> {t('generating')}
            </>
          ) : (
            <>
              <Download className="h-4 w-4" /> {t('ia_export')}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
