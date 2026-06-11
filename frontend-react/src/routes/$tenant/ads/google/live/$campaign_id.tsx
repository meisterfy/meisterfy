import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/store/auth'
import {
  getLiveCampaignDetail,
  getDbMetrics,
  getDeviceBreakdown,
  getHourlyBreakdown,
  getImpressionShare,
  getSearchTerms,
  getKeywordQualityScores,
  getKeywordPerformance,
  type LiveCampaignDetail,
  type DbHistoryDay,
  type DeviceRow,
  type HourlyRow,
  type ImpressionShareStats,
  type SearchTermRow,
  type KeywordQSRow,
  type KeywordPerfRow,
} from '@/lib/api/campaigns'
import { getTenant } from '@/lib/api/tenants'
import { withFallback } from '@/lib/utils/loader'
import { buildCampaignData, buildChatSystemPrompt, type BrandContext } from '@/lib/ai/campaign-context'
import { useCampaignActions } from '@/features/campaigns/use-campaign-actions'
import { useCampaignChat } from '@/features/campaigns/use-campaign-chat'
import { FloatingChat } from '@/components/chat/floating-chat'
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs'
import { TabTrigger } from '@/components/ads-live/tab-trigger'
import { LiveHeader } from '@/components/ads-live/header'
import { Skeleton } from '@/components/ads-live/skeleton'
import { LiveTab } from '@/components/ads-live/live-tab'
import { HistoryTab } from '@/components/ads-live/history-tab'
import { SearchIntelligenceTab } from '@/components/ads-live/search-intelligence-tab'
import { AiReportTab } from '@/components/ads-live/ai-report-tab'

export const Route = createFileRoute('/$tenant/ads/google/live/$campaign_id')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: LiveCampaignRoute,
})

const EMPTY_BRAND: BrandContext = {
  name: '',
  niche: null,
  location: null,
  primary_persona: null,
  tone: null,
  instructions: null,
  report_prompts: null,
}

interface LiveData {
  detail: LiveCampaignDetail | null
  dbHistory: DbHistoryDay[]
  devices: DeviceRow[]
  hourly: HourlyRow[]
  impressionShare: ImpressionShareStats | null
  searchTerms: SearchTermRow[]
  qualityScores: KeywordQSRow[]
  keywords: KeywordPerfRow[]
  brand: BrandContext
  chatSystemPrompt: string
}

export function LiveCampaignRoute() {
  const { tenant, campaign_id } = Route.useParams()
  const { t } = useTranslation('ads')
  const actions = useCampaignActions()
  const chat = useCampaignChat(tenant, campaign_id)

  const [data, setData] = useState<LiveData | null>(null)
  // Period filter — the Svelte drove this via ?startDate&endDate query params;
  // here it is local state that re-runs the imperative load.
  const [dateParams, setDateParams] = useState<{ startDate?: string; endDate?: string }>({})
  const [isLoadingPeriod, setIsLoadingPeriod] = useState(false)

  const load = useCallback(
    async (params: { startDate?: string; endDate?: string }): Promise<LiveData> => {
      const [
        detail,
        dbHistory,
        devices,
        hourly,
        impressionShare,
        searchTerms,
        qualityScores,
        keywords,
        client,
      ] = await Promise.all([
        withFallback(getLiveCampaignDetail(tenant, campaign_id, params), null),
        withFallback(getDbMetrics(tenant, 180, campaign_id), []),
        withFallback(getDeviceBreakdown(tenant, campaign_id, params), []),
        withFallback(getHourlyBreakdown(tenant, campaign_id, params), []),
        withFallback(getImpressionShare(tenant, campaign_id, params), null),
        withFallback(getSearchTerms(tenant, campaign_id, params), []),
        withFallback(getKeywordQualityScores(tenant, campaign_id), []),
        withFallback(getKeywordPerformance(tenant, campaign_id, params), []),
        withFallback(getTenant(tenant), null),
      ])

      const brand: BrandContext = client
        ? {
            name: client.name,
            niche: client.niche,
            location: client.location,
            primary_persona: client.primary_persona,
            tone: client.tone,
            instructions: client.instructions,
            report_prompts: client.report_prompts,
          }
        : EMPTY_BRAND

      const chatSystemPrompt = detail
        ? buildChatSystemPrompt(brand, buildCampaignData(detail, searchTerms, keywords, qualityScores))
        : ''

      return {
        detail,
        dbHistory,
        devices,
        hourly,
        impressionShare,
        searchTerms,
        qualityScores,
        keywords,
        brand,
        chatSystemPrompt,
      }
    },
    [tenant, campaign_id],
  )

  useEffect(() => {
    let active = true
    setIsLoadingPeriod(true)
    load(dateParams)
      .then((d) => {
        if (active) setData(d)
      })
      .finally(() => {
        if (active) setIsLoadingPeriod(false)
      })
    return () => {
      active = false
    }
  }, [load, dateParams])

  function setPeriod(days: number) {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    setDateParams({ startDate: fmt(start), endDate: fmt(end) })
  }

  function clearPeriod() {
    setDateParams({})
  }

  return (
    <div className="gap-4 p-4 lg:p-8">
      {!data ? (
        <Skeleton />
      ) : (
        <LiveHeader
          detail={data.detail}
          tenant={tenant}
          campaignId={campaign_id}
          actions={actions}
        />
      )}

      <Tabs defaultValue="live">
        <TabsList className="flex items-center justify-start gap-2 border-b border-white/10 py-4 lg:gap-4">
          <TabTrigger value="live">
            <div className="flex items-center gap-2">
              {t('headings.live_performance')}
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400/70" />
            </div>
          </TabTrigger>
          <TabTrigger value="history">{t('headings.campaign_history')}</TabTrigger>
          <TabTrigger value="search">{t('headings.search_intelligence')}</TabTrigger>
          <TabTrigger value="ai">
            <div className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              </svg>
              {t('headings.ai_report')}
            </div>
          </TabTrigger>
        </TabsList>

        <TabsContent value="live">
          <LiveTab
            detail={data?.detail ?? null}
            isLoadingPeriod={isLoadingPeriod}
            onSetPeriod={setPeriod}
            onClearPeriod={clearPeriod}
            devices={data?.devices ?? []}
            hourly={data?.hourly ?? []}
            impressionShare={data?.impressionShare ?? null}
          />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab history={data?.dbHistory ?? []} />
        </TabsContent>

        <TabsContent value="search">
          <SearchIntelligenceTab
            detail={data?.detail ?? null}
            searchTerms={data?.searchTerms ?? []}
            qualityScores={data?.qualityScores ?? []}
            keywords={data?.keywords ?? []}
          />
        </TabsContent>

        <TabsContent value="ai">
          <AiReportTab
            tenant={tenant}
            campaignId={campaign_id}
            brand={data?.brand ?? EMPTY_BRAND}
            detail={data?.detail ?? null}
            searchTerms={data?.searchTerms ?? []}
            keywords={data?.keywords ?? []}
            qualityScores={data?.qualityScores ?? []}
          />
        </TabsContent>
      </Tabs>

      {/* Floating AI chat — persists across tab switches */}
      <FloatingChat
        chat={chat}
        systemPrompt={data?.chatSystemPrompt ?? ''}
        tenantId={tenant}
        campaignId={campaign_id}
      />
    </div>
  )
}
