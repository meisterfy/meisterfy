import { useState, useEffect } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Share2, Plus, Trash2 } from 'lucide-react'

import { useAuth } from '@/store/auth'
import { getConnectorResources } from '@/lib/api/connector-resources'
import type { ConnectorResource } from '@/lib/api/connector-resources'
import { removeMetaPage } from '@/lib/api/social-accounts'
import { Container } from '@/components/container'
import { CardAside } from '@/components/card-aside'
import { CheckboxCard } from '@/components/checkbox-card'
import { SaveButton } from '@/components/save-button'
import { Switch } from '@/components/ui/switch'
import { MetaPagePicker } from '@/features/social-settings/meta-page-picker'

export const Route = createFileRoute('/$tenant/settings/social')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: SocialRoute,
})

// ── Pure helpers (module scope — not timezone-stable in unit tests) ────────────

/**
 * Returns the local wall-clock representation of a UTC hour.
 * e.g. localTime(6) → "06:00 UTC" (browser-dependent)
 */
export function localTime(utcHour: number): string {
  const d = new Date()
  d.setUTCHours(utcHour, 0, 0, 0)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
}

/**
 * Returns a human-readable weekly schedule string for a UTC hour on Monday.
 * e.g. "Every Monday at 06:00 UTC"
 * NOTE: Result is timezone/Date.now-dependent — no unit tests are written for this.
 */
export function weeklyLocalSchedule(utcHour: number): string {
  const d = new Date()
  const daysUntilMonday = (1 - d.getUTCDay() + 7) % 7 || 7
  d.setUTCDate(d.getUTCDate() + daysUntilMonday)
  d.setUTCHours(utcHour, 0, 0, 0)
  const day = d.toLocaleDateString([], { weekday: 'long' })
  const time = d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  return `Every ${day} at ${time}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SocialRoute() {
  const { tenant } = Route.useParams()
  const { t } = useTranslation('settings')
  const { t: tGlobals } = useTranslation('globals')

  // ── Social accounts state ──────────────────────────────────────────────────
  const [connectedPages, setConnectedPages] = useState<ConnectorResource[]>([])
  const [pagesLoading, setPagesLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  // ── Monitoring state (local-only stub) ─────────────────────────────────────
  const [syncInsights, setSyncInsights] = useState(false)
  const [aiReportDaily, setAiReportDaily] = useState(false)
  const [aiReportWeekly, setAiReportWeekly] = useState(false)
  const [aiReportMonthly, setAiReportMonthly] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Load connected pages ───────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setPagesLoading(true)
      setConnectedPages(await getConnectorResources(tenant, 'meta', 'page').catch(() => []))
      setPagesLoading(false)
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────────

  function onPageAdded(resource: ConnectorResource) {
    setConnectedPages((ps) => [...ps, resource])
  }

  async function removePage(resource: ConnectorResource) {
    setRemovingId(resource.id)
    setRemoveError(null)
    try {
      await removeMetaPage(tenant, resource.id)
      setConnectedPages((ps) => ps.filter((p) => p.id !== resource.id))
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : tGlobals('error_generic'))
    } finally {
      setRemovingId(null)
    }
  }

  async function saveMonitoring() {
    setIsSaving(true)
    setSaveError(null)
    try {
      await new Promise((r) => setTimeout(r, 300))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className='py-8'>
        <Container className='space-y-8 lg:space-y-16'>

          {/* Social Accounts */}
          <CardAside
            title={t('social_accounts_title')}
            description={t('social_accounts_desc')}
          >
            <div className='space-y-6'>

              {/* Meta */}
              <div>
                <div className='mb-3 flex items-center gap-2'>
                  <span className='text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400'>
                    Meta
                  </span>
                  {connectedPages.length > 0 && (
                    <span className='rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400'>
                      {t('social_meta_connected')}
                    </span>
                  )}
                </div>

                {pagesLoading ? (
                  <div className='space-y-2'>
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className='animate-pulse rounded-lg border border-slate-100 p-3 dark:border-slate-800'
                      >
                        <div className='h-4 w-40 rounded bg-slate-200 dark:bg-slate-700' />
                      </div>
                    ))}
                  </div>
                ) : connectedPages.length > 0 ? (
                  <ul className='divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700'>
                    {connectedPages.map((resource) => {
                      const igUsername = resource.metadata?.ig_username as string | null
                      return (
                        <li key={resource.id} className='flex items-center gap-3 p-3'>
                          <div className='flex shrink-0 items-center gap-1'>
                            {igUsername && (
                              <span className='rounded bg-pink-100 px-1.5 py-0.5 text-[10px] font-bold text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'>
                                IG
                              </span>
                            )}
                            <span className='rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'>
                              FB
                            </span>
                          </div>

                          <div className='min-w-0 flex-1'>
                            <p className='truncate text-sm font-medium text-slate-900 dark:text-white'>
                              {resource.resource_name ?? resource.resource_id}
                            </p>
                            {igUsername && (
                              <p className='text-xs text-slate-500 dark:text-slate-400'>
                                @{igUsername}
                              </p>
                            )}
                          </div>

                          <button
                            type='button'
                            disabled={removingId === resource.id}
                            onClick={() => removePage(resource)}
                            className='shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-900/20'
                            aria-label={t('social_remove')}
                          >
                            <Trash2 className='h-4 w-4' />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}

                {removeError && (
                  <p className='mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400'>
                    {removeError}
                  </p>
                )}

                <button
                  type='button'
                  onClick={() => setPickerOpen(true)}
                  className='mt-3 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-600 dark:hover:text-indigo-400'
                >
                  <Plus className='h-4 w-4' />
                  {t('social_meta_add')}
                </button>
              </div>

              {/* LinkedIn */}
              <div className='flex items-center justify-between rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50'>
                <div className='flex items-center gap-3'>
                  <span className='rounded bg-blue-700 px-1.5 py-0.5 text-[10px] font-bold text-white'>
                    in
                  </span>
                  <span className='text-sm font-medium text-slate-700 dark:text-slate-300'>
                    LinkedIn
                  </span>
                </div>
                <span className='rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-400'>
                  {t('social_coming_soon')}
                </span>
              </div>

              {/* X / Twitter */}
              <div className='flex items-center justify-between rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50'>
                <div className='flex items-center gap-3'>
                  <Share2 className='h-5 w-5 text-slate-800 dark:text-slate-200' />
                  <span className='text-sm font-medium text-slate-700 dark:text-slate-300'>X</span>
                </div>
                <span className='rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-400'>
                  {t('social_coming_soon')}
                </span>
              </div>

            </div>
          </CardAside>

          {/* Monitoring */}
          <CardAside
            title={t('social_monitoring_title')}
            description={t('social_monitoring_desc')}
            header={
              <div className='flex items-end justify-between gap-4'>
                <div className='flex flex-col gap-1'>
                  <p className='text-text text-sm font-medium lg:text-lg xl:text-xl'>
                    {t('social_sync_insights_label')}
                  </p>
                  <p className='lg:text-md text-primary/70 text-xs'>
                    {t('social_sync_insights_desc')}
                  </p>
                </div>
                {/* Switch — using React Switch default styling (base-ui); the Svelte
                    Switch.Root had custom Tailwind classes; the React wrapper uses
                    base-ui data-attributes and its own tokens. No className override
                    applied — accepted deviation documented in report. */}
                <Switch
                  checked={syncInsights}
                  onCheckedChange={(checked) => setSyncInsights(checked)}
                />
              </div>
            }
            footer={<SaveButton isSaving={isSaving} saved={saved} onClick={saveMonitoring} />}
          >
            <div className='space-y-4'>
              <p className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-400'>
                {t('social_monitoring_beta_note')}
              </p>

              <div className='prose prose-sm prose-indigo dark:prose-invert prose-p:mb-0 prose-headings:m-0'>
                <h3>{t('social_ai_reports_title')}</h3>
                <p>{t('social_ai_reports_desc')}</p>
              </div>

              <div className='flex flex-col gap-3'>
                <CheckboxCard
                  checked={aiReportDaily}
                  onCheckedChange={setAiReportDaily}
                  title={t('social_report_daily_title')}
                  description={t('social_report_daily_desc', { time: localTime(6) })}
                />
                <CheckboxCard
                  checked={aiReportWeekly}
                  onCheckedChange={setAiReportWeekly}
                  title={t('social_report_weekly_title')}
                  description={t('social_report_weekly_desc', { schedule: weeklyLocalSchedule(6) })}
                />
                <CheckboxCard
                  checked={aiReportMonthly}
                  onCheckedChange={setAiReportMonthly}
                  title={t('social_report_monthly_title')}
                  description={t('social_report_monthly_desc', { time: localTime(6) })}
                />
              </div>

              {saveError && (
                <p className='rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400'>
                  {saveError}
                </p>
              )}
            </div>
          </CardAside>

        </Container>
      </div>

      <MetaPagePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        tenant={tenant}
        onAdded={onPageAdded}
      />
    </>
  )
}
