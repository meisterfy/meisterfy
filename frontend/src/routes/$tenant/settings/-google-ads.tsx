import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { HelpCircle } from 'lucide-react'
import { getTenant, updateTenant, getGoogleAdsStatus } from '@/lib/api/tenants'
import type { AdsMonitoringConfig, ReportPrompts } from '@/lib/api/tenants'
import { getAIProviders } from '@/lib/api/ai'
import { qk, fallbackQuery } from '@/lib/query'
import { DEFAULT_PROMPTS, PROMPT_PARAMS } from '@/lib/ai/prompts'
import { Container } from '@/components/container'
import { CardAside } from '@/components/card-aside'
import { CheckboxCard } from '@/components/checkbox-card'
import { SaveButton } from '@/components/save-button'
import { Switch } from '@/components/ui/switch'
import { NumberField } from '@/components/ui/number-field'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Route } from './google-ads'

// ── Pure helpers (module scope — not timezone-stable in unit tests) ────────────

/**
 * Returns the local wall-clock representation of a UTC hour.
 * e.g. localTime(6) → "06:00 UTC" (browser-dependent)
 */
export function localTime(utcHour: number): string {
  const d = new Date()
  d.setUTCHours(utcHour, 0, 0, 0)
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
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

// ── Inline helpers for CardHeader / CardContent (matching social.tsx pattern) ─

function CardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-text text-sm font-medium lg:text-lg xl:text-xl">
        {title}
      </p>
      <p className="lg:text-md text-primary/70 text-xs">{subtitle}</p>
    </div>
  )
}

function CardContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="prose prose-sm prose-indigo dark:prose-invert prose-p:mb-0 prose-headings:m-0">
      {children}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GoogleAdsRoute() {
  const { tenant } = Route.useParams()
  const { t } = useTranslation('settings')
  const { t: tGlobals } = useTranslation('globals')

  // ── Tenant query (for existing config) ────────────────────────────────────
  const tenantQuery = useQuery({
    queryKey: qk.tenant(tenant),
    queryFn: () => fallbackQuery(() => getTenant(tenant), null),
  })

  const existingCfg = tenantQuery.data?.ads_monitoring ?? null

  // ── Status (imperative — gads + llm) ──────────────────────────────────────
  const [gadsConnected, setGadsConnected] = useState(false)
  const [llmConnected, setLlmConnected] = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getGoogleAdsStatus(tenant).catch(() => ({ connected: false })),
      getAIProviders(tenant).catch(() => []),
    ]).then(([gads, providers]) => {
      setGadsConnected(gads.connected)
      setLlmConnected(providers.length > 0)
      setStatusLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Ads config form state (seeded once from existingCfg) ──────────────────
  const [syncEnabled, setSyncEnabled] = useState(false)
  const [aiReportDaily, setAiReportDaily] = useState(false)
  const [aiReportWeekly, setAiReportWeekly] = useState(false)
  const [aiReportMonthly, setAiReportMonthly] = useState(false)
  const [adjustmentsEnabled, setAdjustmentsEnabled] = useState(false)
  const [maxIncreasePct, setMaxIncreasePct] = useState(20)
  const [maxIncreaseBRL, setMaxIncreaseBRL] = useState(50)
  const [maxDecreasePct, setMaxDecreasePct] = useState(10)
  const [maxDecreaseBRL, setMaxDecreaseBRL] = useState(20)
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(false)
  const [minCampaignAgeDays, setMinCampaignAgeDays] = useState(14)
  const [adjustmentIntervalDays, setAdjustmentIntervalDays] = useState(7)

  // Seed ads config once when tenant data arrives — guard avoids clobbering user edits
  const adsSeedRef = useRef(false)
  useEffect(() => {
    if (tenantQuery.data && !adsSeedRef.current) {
      const cfg = tenantQuery.data.ads_monitoring
      setSyncEnabled(cfg?.sync_enabled ?? false)
      setAiReportDaily(cfg?.ai_report_daily ?? false)
      setAiReportWeekly(cfg?.ai_report_weekly ?? false)
      setAiReportMonthly(cfg?.ai_report_monthly ?? false)
      setAdjustmentsEnabled(cfg?.adjustments_enabled ?? false)
      setMaxIncreasePct(cfg?.max_increase_pct ?? 20)
      setMaxIncreaseBRL(cfg?.max_increase_brl ?? 50)
      setMaxDecreasePct(cfg?.max_decrease_pct ?? 10)
      setMaxDecreaseBRL(cfg?.max_decrease_brl ?? 20)
      setSuggestionsEnabled(cfg?.suggestions_enabled ?? false)
      setMinCampaignAgeDays(cfg?.min_campaign_age_days ?? 14)
      setAdjustmentIntervalDays(cfg?.adjustment_interval_days ?? 7)
      adsSeedRef.current = true
    }
  }, [tenantQuery.data])

  const aggressiveWarning = useMemo(
    () => minCampaignAgeDays < 10 || adjustmentIntervalDays < 5,
    [minCampaignAgeDays, adjustmentIntervalDays],
  )

  // ── Prompts form state (seeded once from existingPrompts) ─────────────────
  const [promptInstant, setPromptInstant] = useState('')
  const [promptDaily, setPromptDaily] = useState('')
  const [promptWeekly, setPromptWeekly] = useState('')
  const [promptMonthly, setPromptMonthly] = useState('')

  const promptsSeedRef = useRef(false)
  useEffect(() => {
    if (tenantQuery.data && !promptsSeedRef.current) {
      const p = tenantQuery.data.report_prompts
      setPromptInstant(p?.instant ?? '')
      setPromptDaily(p?.daily ?? '')
      setPromptWeekly(p?.weekly ?? '')
      setPromptMonthly(p?.monthly ?? '')
      promptsSeedRef.current = true
    }
  }, [tenantQuery.data])

  // ── Save state ─────────────────────────────────────────────────────────────
  const [isSavingAds, setIsSavingAds] = useState(false)
  const [savedAds, setSavedAds] = useState(false)
  const [adsError, setAdsError] = useState<string | null>(null)

  const [isSavingPrompts, setIsSavingPrompts] = useState(false)
  const [savedPrompts, setSavedPrompts] = useState(false)
  const [promptsError, setPromptsError] = useState<string | null>(null)

  const [helpOpen, setHelpOpen] = useState(false)

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function saveAdsConfig() {
    setAdsError(null)
    setIsSavingAds(true)
    try {
      const merged: AdsMonitoringConfig = {
        ...(existingCfg ?? {
          target_cpa_brl: 0,
          no_conversion_alert_days: 0,
          max_cpa_multiplier: 0,
          min_daily_impressions: 0,
          budget_underpace_threshold: 0,
        }),
        sync_enabled: syncEnabled,
        ai_report_daily: aiReportDaily,
        ai_report_weekly: aiReportWeekly,
        ai_report_monthly: aiReportMonthly,
        adjustments_enabled: adjustmentsEnabled,
        max_increase_pct: maxIncreasePct,
        max_increase_brl: maxIncreaseBRL,
        max_decrease_pct: maxDecreasePct,
        max_decrease_brl: maxDecreaseBRL,
        suggestions_enabled: suggestionsEnabled,
        min_campaign_age_days: minCampaignAgeDays,
        adjustment_interval_days: adjustmentIntervalDays,
      }
      await updateTenant(tenant, { ads_monitoring: merged })
      setSavedAds(true)
      setTimeout(() => setSavedAds(false), 2500)
    } catch (err) {
      setAdsError(
        err instanceof Error ? err.message : tGlobals('error_generic'),
      )
    } finally {
      setIsSavingAds(false)
    }
  }

  async function savePrompts() {
    setPromptsError(null)
    setIsSavingPrompts(true)
    try {
      const prompts: ReportPrompts = {
        instant: promptInstant.trim() || undefined,
        daily: promptDaily.trim() || undefined,
        weekly: promptWeekly.trim() || undefined,
        monthly: promptMonthly.trim() || undefined,
      }
      await updateTenant(tenant, { report_prompts: prompts })
      setSavedPrompts(true)
      setTimeout(() => setSavedPrompts(false), 2500)
    } catch (err) {
      setPromptsError(
        err instanceof Error ? err.message : tGlobals('error_generic'),
      )
    } finally {
      setIsSavingPrompts(false)
    }
  }

  function resetPrompt(type: keyof typeof DEFAULT_PROMPTS) {
    if (type === 'instant') setPromptInstant('')
    else if (type === 'daily') setPromptDaily('')
    else if (type === 'weekly') setPromptWeekly('')
    else setPromptMonthly('')
  }

  const promptFields = [
    {
      key: 'instant' as const,
      label: t('prompt_instant_label'),
      placeholder: DEFAULT_PROMPTS.instant,
      value: promptInstant,
      set: setPromptInstant,
    },
    {
      key: 'daily' as const,
      label: t('prompt_daily_label'),
      placeholder: DEFAULT_PROMPTS.daily,
      value: promptDaily,
      set: setPromptDaily,
    },
    {
      key: 'weekly' as const,
      label: t('prompt_weekly_label'),
      placeholder: DEFAULT_PROMPTS.weekly,
      value: promptWeekly,
      set: setPromptWeekly,
    },
    {
      key: 'monthly' as const,
      label: t('prompt_monthly_label'),
      placeholder: DEFAULT_PROMPTS.monthly,
      value: promptMonthly,
      set: setPromptMonthly,
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="py-8">
        <Container className="space-y-8 lg:space-y-16">
          {statusLoading ? (
            <div className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 h-4 w-48 rounded bg-slate-200 dark:bg-slate-700"></div>
              <div className="h-3 w-80 rounded bg-slate-100 dark:bg-slate-800"></div>
            </div>
          ) : !gadsConnected ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800/40 dark:bg-amber-900/10">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {t('gads_no_integration')}
              </p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                {/* i18n message renders an anchor — content from translation strings, not user input */}
                <span
                  dangerouslySetInnerHTML={{
                    __html: t('gads_no_integration_desc', {
                      link: `<a href="/${tenant}/integrations" class="underline">${t('gads_integrations_link')}</a>`,
                    }),
                  }}
                />
              </p>
            </div>
          ) : (
            <>
              {/* Data Sync */}
              <CardAside
                title={t('data_sync_title')}
                description={t('data_sync_desc')}
                header={
                  <div className="flex items-end justify-between gap-4">
                    <CardHeader
                      title={t('sync_toggle_label')}
                      subtitle={t('sync_toggle_desc')}
                    />
                    <Switch
                      checked={syncEnabled}
                      onCheckedChange={(checked) => setSyncEnabled(checked)}
                    />
                  </div>
                }
                footer={
                  <SaveButton
                    isSaving={isSavingAds}
                    saved={savedAds}
                    onClick={saveAdsConfig}
                  />
                }
              >
                {llmConnected && (
                  <div className="space-y-4 lg:space-y-6">
                    <CardContent>
                      <h3>{t('ai_reports_title')}</h3>
                      <p>{t('ai_reports_desc')}</p>
                    </CardContent>
                    <div className="flex flex-col gap-3">
                      <CheckboxCard
                        checked={aiReportDaily}
                        onCheckedChange={setAiReportDaily}
                        title={t('report_daily_title')}
                        description={t('report_daily_desc', {
                          time: localTime(6),
                        })}
                      />
                      <CheckboxCard
                        checked={aiReportWeekly}
                        onCheckedChange={setAiReportWeekly}
                        title={t('report_weekly_title')}
                        description={t('report_weekly_desc', {
                          schedule: weeklyLocalSchedule(6),
                        })}
                      />
                      <CheckboxCard
                        checked={aiReportMonthly}
                        onCheckedChange={setAiReportMonthly}
                        title={t('report_monthly_title')}
                        description={t('report_monthly_desc', {
                          time: localTime(6),
                        })}
                      />
                    </div>
                  </div>
                )}
                {adsError && (
                  <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {adsError}
                  </p>
                )}
              </CardAside>

              {/* Report Prompts — only when LLM connected */}
              {llmConnected && (
                <CardAside
                  aside={
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-text text-base font-semibold">
                          {t('report_prompts_title')}
                        </h2>
                        <button
                          type="button"
                          onClick={() => setHelpOpen(true)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          aria-label={t('report_prompts_help_aria')}
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-text/70 mt-1 text-sm">
                        {t('report_prompts_desc', { param: '[brand_name]' })}
                      </p>
                    </div>
                  }
                  footer={
                    <SaveButton
                      isSaving={isSavingPrompts}
                      saved={savedPrompts}
                      onClick={savePrompts}
                      text={t('save_prompts')}
                    />
                  }
                >
                  <div className="flex flex-col gap-6">
                    {promptFields.map((field) => (
                      <div key={field.key}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label
                            htmlFor={`prompt-${field.key}`}
                            className="text-xs font-semibold tracking-wide text-slate-500 uppercase"
                          >
                            {field.label}
                          </label>
                          {field.value.trim() && (
                            <button
                              type="button"
                              onClick={() => resetPrompt(field.key)}
                              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                              {t('reset_to_default')}
                            </button>
                          )}
                        </div>
                        <textarea
                          id={`prompt-${field.key}`}
                          rows={10}
                          value={field.value}
                          onChange={(e) => field.set(e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    ))}
                  </div>
                  {promptsError && (
                    <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                      {promptsError}
                    </p>
                  )}
                </CardAside>
              )}

              {/* Campaign Adjustments */}
              <CardAside
                title={t('campaign_adj_title')}
                description={t('campaign_adj_desc')}
                header={
                  <div className="flex items-end justify-between gap-4">
                    <CardHeader
                      title={t('campaign_adj_toggle_label')}
                      subtitle={t('campaign_adj_toggle_desc')}
                    />
                    <Switch
                      checked={adjustmentsEnabled}
                      onCheckedChange={(checked) =>
                        setAdjustmentsEnabled(checked)
                      }
                    />
                  </div>
                }
              >
                {adjustmentsEnabled ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <NumberField
                        id="adj-inc-pct"
                        label={t('field_max_increase_pct')}
                        suffix="%"
                        max={100}
                        value={maxIncreasePct}
                        onValueChange={setMaxIncreasePct}
                      />
                      <NumberField
                        id="adj-inc-brl"
                        label={t('field_max_increase_brl')}
                        suffix="R$"
                        value={maxIncreaseBRL}
                        onValueChange={setMaxIncreaseBRL}
                      />
                      <NumberField
                        id="adj-dec-pct"
                        label={t('field_max_decrease_pct')}
                        suffix="%"
                        max={100}
                        value={maxDecreasePct}
                        onValueChange={setMaxDecreasePct}
                      />
                      <NumberField
                        id="adj-dec-brl"
                        label={t('field_max_decrease_brl')}
                        suffix="R$"
                        value={maxDecreaseBRL}
                        onValueChange={setMaxDecreaseBRL}
                      />
                    </div>
                    <SaveButton
                      isSaving={isSavingAds}
                      saved={savedAds}
                      onClick={saveAdsConfig}
                      className="mt-4"
                    />
                  </>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('gads_enable_to_edit')}
                  </span>
                )}
              </CardAside>

              {/* Automatic Adjustments */}
              <CardAside
                title={t('auto_adj_title')}
                description={t('auto_adj_desc')}
                header={
                  <div className="flex items-end justify-between gap-4">
                    <CardHeader
                      title={t('auto_adj_suggestions_label')}
                      subtitle={t('auto_adj_suggestions_desc')}
                    />
                    <Switch
                      checked={suggestionsEnabled}
                      onCheckedChange={(checked) =>
                        setSuggestionsEnabled(checked)
                      }
                    />
                  </div>
                }
                footer={
                  <SaveButton
                    isSaving={isSavingAds}
                    saved={savedAds}
                    onClick={saveAdsConfig}
                  />
                }
              >
                <div className="space-y-5">
                  <div>
                    <NumberField
                      id="min-campaign-age"
                      label={t('auto_adj_min_age_label')}
                      suffix={t('auto_adj_days_suffix')}
                      value={minCampaignAgeDays}
                      onValueChange={setMinCampaignAgeDays}
                    />
                    <div className="mt-2 flex gap-1.5">
                      {[7, 14, 21, 30].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setMinCampaignAgeDays(preset)}
                          className={`rounded border px-2 py-0.5 text-xs font-medium transition-colors ${
                            minCampaignAgeDays === preset
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                          }`}
                        >
                          {preset}d
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <NumberField
                      id="adjustment-interval"
                      label={t('auto_adj_interval_label')}
                      suffix={t('auto_adj_days_suffix')}
                      value={adjustmentIntervalDays}
                      onValueChange={setAdjustmentIntervalDays}
                    />
                    <div className="mt-2 flex gap-1.5">
                      {[3, 7, 14].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAdjustmentIntervalDays(preset)}
                          className={`rounded border px-2 py-0.5 text-xs font-medium transition-colors ${
                            adjustmentIntervalDays === preset
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                          }`}
                        >
                          {preset}d
                        </button>
                      ))}
                    </div>
                  </div>

                  {aggressiveWarning && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                      {t('auto_adj_aggressive_warning')}
                    </p>
                  )}
                </div>
              </CardAside>
            </>
          )}
        </Container>
      </div>

      {/* Parameters help modal — rendered outside Container so it is always available */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-lg" showCloseButton={false}>
          <p className="mb-1 text-base font-semibold text-slate-900 dark:text-white">
            {t('params_modal_title')}
          </p>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {t('params_modal_desc')}
          </p>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {PROMPT_PARAMS.map((param) => (
              <div key={param.key} className="flex items-start gap-3 py-3">
                <code className="shrink-0 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-indigo-600 dark:bg-slate-800 dark:text-indigo-400">
                  {param.key}
                </code>
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {param.description}
                  </p>
                  <p className="text-xs text-slate-400">
                    {t('params_modal_example', { example: param.example })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <DialogClose className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              {t('params_modal_close')}
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
