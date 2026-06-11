import { Activity, CircleAlert, CircleCheck, Search, SquarePen, Trash2, Send } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

// Row shape shared by the table, its cells and the list route. Mirrors the
// Svelte UnifiedCampaign (columns.ts) — local (db) + live (Google Ads) merged.
export interface UnifiedCampaign {
  id: string
  name: string
  slug?: string
  status: string
  cost?: string
  impressions?: number
  clicks?: number
  objective?: string
  type: 'live' | 'local'
  tenant: string
}

// Live (C9: .../live/$campaign_id) and detail (C8: .../$slug) routes now exist
// → typed <Link>s.
export function CampaignNameCell({
  name,
  id,
  slug,
  type,
  objective,
  tenant,
}: Pick<UnifiedCampaign, 'name' | 'id' | 'slug' | 'type' | 'objective' | 'tenant'>) {
  const { t } = useTranslation('ads')
  const linkClass =
    'block font-bold text-slate-900 transition-colors hover:text-indigo-600 dark:text-white'
  return (
    <div className="flex items-center gap-3">
      {type === 'local' && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30">
          <Search className="h-4 w-4" />
        </div>
      )}
      <div>
        {type === 'live' ? (
          <Link
            to="/$tenant/ads/google/live/$campaign_id"
            params={{ tenant, campaign_id: id }}
            className={linkClass}
          >
            {name}
          </Link>
        ) : (
          <Link
            to="/$tenant/ads/google/$slug"
            params={{ tenant, slug: slug ?? '' }}
            className={linkClass}
          >
            {id}
          </Link>
        )}
        {type === 'local' && objective ? (
          <span className="text-xs text-slate-500">{objective}</span>
        ) : type === 'live' ? (
          <span className="text-xs text-slate-500">{t('live_in_google_ads')}</span>
        ) : null}
      </div>
    </div>
  )
}

export function CampaignStatusBadge({
  status,
  type,
}: Pick<UnifiedCampaign, 'status' | 'type'>) {
  const { t } = useTranslation('ads')
  if (type === 'live') {
    if (status === 'ENABLED') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400">
          <Activity className="h-3.5 w-3.5" />
          {t('status.active')}
        </span>
      )
    }
    if (status === 'PAUSED') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <CircleAlert className="h-3.5 w-3.5" />
          {t('status.paused')}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {status}
      </span>
    )
  }
  if (status === 'draft') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400">
        <CircleAlert className="h-3.5 w-3.5" /> Draft
      </span>
    )
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400">
        <CircleCheck className="h-3.5 w-3.5" /> Approved
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <Activity className="h-3.5 w-3.5" />
      {status}
    </span>
  )
}

export function CampaignActions({
  campaign,
  onDeploy,
}: {
  campaign: UnifiedCampaign
  onDeploy?: (slug: string) => void
}) {
  const { t } = useTranslation('ads')
  return (
    <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
      {campaign.type === 'live' ? (
        <Link
          to="/$tenant/ads/google/live/$campaign_id"
          params={{ tenant: campaign.tenant, campaign_id: campaign.id }}
          className="rounded border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-indigo-900/30"
          title={t('view_detailed_report')}
        >
          <Activity className="h-4 w-4" />
        </Link>
      ) : (
        <>
          {campaign.status === 'approved' && onDeploy && (
            <button
              type="button"
              onClick={() => campaign.slug && onDeploy(campaign.slug)}
              className="rounded border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-emerald-900/30"
              title={t('deploy_to_google_ads')}
            >
              <Send className="h-4 w-4" />
            </button>
          )}
          <Link
            to="/$tenant/ads/google/$slug"
            params={{ tenant: campaign.tenant, slug: campaign.slug ?? '' }}
            className="rounded border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-indigo-900/30"
            title="Edit"
          >
            <SquarePen className="h-4 w-4" />
          </Link>
          <button
            type="button"
            className="rounded border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-red-900/30"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}
