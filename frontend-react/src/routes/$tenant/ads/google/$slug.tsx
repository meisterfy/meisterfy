import { useEffect, useState } from 'react'
import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Save, Search, LayoutList } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { getCampaign, updateCampaign } from '@/lib/api/campaigns'
import { normalizeCampaign } from '@/lib/utils/transforms'
import { withFallback } from '@/lib/utils/loader'

interface ResponsiveSearchAd {
  headlines: string[]
  descriptions: string[]
}
interface AdGroup {
  name: string
  keywords: string[]
  negative_keywords: string[]
  responsive_search_ad: ResponsiveSearchAd
}
interface CampaignDetail {
  id?: string
  slug?: string
  status?: string
  platform?: string
  objective?: string
  budget_suggestion?: string
  ad_groups?: AdGroup[]
  workflow?: { reasoning?: string } | null
  [k: string]: unknown
}

export const Route = createFileRoute('/$tenant/ads/google/$slug')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: CampaignDetailRoute,
})

export function CampaignDetailRoute() {
  const { tenant, slug } = Route.useParams()
  const { t } = useTranslation('ads')
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let active = true
    withFallback(getCampaign(tenant, slug), null)
      .then((c) => {
        if (!active) return
        if (!c) {
          setNotFound(true)
          return
        }
        setCampaign(normalizeCampaign(c, c.tenant_id) as unknown as CampaignDetail)
      })
      .catch(() => {
        if (active) setNotFound(true)
      })
    return () => {
      active = false
    }
  }, [tenant, slug])

  async function saveCampaign() {
    if (!campaign) return
    setSaving(true)
    setSaveError('')
    try {
      await updateCampaign(
        tenant,
        campaign.slug as string,
        { ...campaign } as Record<string, string | number | boolean | null | object>,
      )
      navigate({ to: '/$tenant/ads/google', params: { tenant } })
    } catch {
      setSaveError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function patch(update: Partial<CampaignDetail>) {
    setCampaign((c) => (c ? { ...c, ...update } : c))
  }

  function setGroupName(i: number, name: string) {
    setCampaign((c) => {
      if (!c?.ad_groups) return c
      const ad_groups = c.ad_groups.map((g, idx) => (idx === i ? { ...g, name } : g))
      return { ...c, ad_groups }
    })
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-5xl p-6 text-sm text-slate-500 dark:text-slate-400">
        Campaign not found
      </div>
    )
  }

  if (!campaign) return null

  return (
    <>
      <div className="sticky top-0 z-10 flex h-14 items-center border-b border-slate-200 bg-white px-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <Link
            to="/$tenant/ads/google"
            params={{ tenant }}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Search className="h-4 w-4 text-slate-400" />
            {t('edit_campaign')}
          </h2>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {saveError && (
            <span className="text-sm text-red-600 dark:text-red-400">{saveError}</span>
          )}
          <button
            type="button"
            onClick={saveCampaign}
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Status'}
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 p-6 lg:grid-cols-3">
        {/* Editor */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 border-b border-slate-100 pb-2 text-lg font-bold text-slate-900 dark:border-slate-800 dark:text-white">
              {t('campaign_details')}
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="campaign-objective"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Objective
                </label>
                <input
                  id="campaign-objective"
                  type="text"
                  value={campaign.objective ?? ''}
                  onChange={(e) => patch({ objective: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="campaign-budget"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  {t('budget_suggestion')}
                </label>
                <input
                  id="campaign-budget"
                  type="text"
                  value={campaign.budget_suggestion ?? ''}
                  onChange={(e) => patch({ budget_suggestion: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <LayoutList className="h-5 w-5 text-indigo-500" />
              {t('ad_groups_section')}
            </h3>

            {(campaign.ad_groups ?? []).map((group, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-4">
                  <label
                    htmlFor={`ad-group-name-${i}`}
                    className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    {t('ad_group_name')}
                  </label>
                  <input
                    id={`ad-group-name-${i}`}
                    type="text"
                    value={group.name}
                    onChange={(e) => setGroupName(i, e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/50"
                  />
                </div>

                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`ad-group-keywords-${i}`}
                      className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Keywords
                    </label>
                    <textarea
                      id={`ad-group-keywords-${i}`}
                      defaultValue={group.keywords.join('\n')}
                      rows={4}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`ad-group-neg-${i}`}
                      className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      {t('negative_keywords')}
                    </label>
                    <textarea
                      id={`ad-group-neg-${i}`}
                      defaultValue={group.negative_keywords.join('\n')}
                      rows={4}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h4 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {t('responsive_search_ad')}
                  </h4>

                  <div className="mb-4 space-y-3">
                    <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      {t('headlines_label')}
                    </span>
                    {group.responsive_search_ad.headlines.map((headline, hi) => (
                      <div key={hi} className="flex items-center gap-2">
                        <input
                          type="text"
                          defaultValue={headline}
                          className={`flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 ${
                            headline.length > 30 ? 'border-red-500 focus:ring-red-500' : ''
                          }`}
                        />
                        <span
                          className={`font-mono text-xs ${
                            headline.length > 30 ? 'font-bold text-red-500' : 'text-slate-400'
                          }`}
                        >
                          {headline.length}/30
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      {t('descriptions_label')}
                    </span>
                    {group.responsive_search_ad.descriptions.map((description, di) => (
                      <div key={di} className="flex items-center gap-2">
                        <input
                          type="text"
                          defaultValue={description}
                          className={`flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 ${
                            description.length > 90 ? 'border-red-500 focus:ring-red-500' : ''
                          }`}
                        />
                        <span
                          className={`font-mono text-xs ${
                            description.length > 90 ? 'font-bold text-red-500' : 'text-slate-400'
                          }`}
                        >
                          {description.length}/90
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Meta */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              {t('campaign_info')}
            </h3>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center justify-between">
                <span>ID</span>
                <span className="font-mono text-xs">{campaign.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status</span>
                <select
                  value={campaign.status ?? 'draft'}
                  onChange={(e) => patch({ status: e.target.value })}
                  className={`rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 ${
                    campaign.status === 'approved' ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  <option value="draft" className="font-medium text-amber-600">
                    draft
                  </option>
                  <option value="approved" className="font-medium text-emerald-600">
                    approved
                  </option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span>Platform</span>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600 uppercase">
                  {campaign.platform}
                </span>
              </div>
            </div>
          </div>

          {campaign.workflow && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
                {t('ai_reasoning')}
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {campaign.workflow.reasoning}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
