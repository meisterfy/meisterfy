import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type React from 'react'
import type { LiveCampaignDetail } from '@/lib/api/campaigns'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...original,
    createFileRoute: (_path: string) => (opts: { beforeLoad?: () => void; component: unknown }) => ({
      ...opts,
      useParams: () => ({ tenant: 'acme', campaign_id: 'c1' }),
    }),
    redirect: original.redirect,
    Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
  }
})
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (k: string) => k }) }
})
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="chart" />,
  Bar: () => <div data-testid="chart" />,
  Chart: () => <div data-testid="chart" />,
  Doughnut: () => <div data-testid="chart" />,
}))
vi.mock('@/lib/api/campaigns', () => ({
  getLiveCampaignDetail: vi.fn(),
  getDbMetrics: vi.fn(),
  getDeviceBreakdown: vi.fn(),
  getHourlyBreakdown: vi.fn(),
  getImpressionShare: vi.fn(),
  getSearchTerms: vi.fn(),
  getKeywordQualityScores: vi.fn(),
  getKeywordPerformance: vi.fn(),
  isSmartManaged: () => false,
}))
vi.mock('@/lib/api/tenants', () => ({ getTenant: vi.fn() }))
vi.mock('@/lib/api/ai', () => ({ getAIProviders: vi.fn().mockResolvedValue([]), streamGenerate: vi.fn() }))
vi.mock('@/lib/api/ai-reports', () => ({ listAIReports: vi.fn().mockResolvedValue([]), saveAIReport: vi.fn() }))
vi.mock('@/features/campaigns/use-campaign-actions', () => ({
  useCampaignActions: () => ({
    syncing: false,
    exporting: false,
    runSyncHistory: vi.fn(),
    exportReport: vi.fn(),
  }),
}))
vi.mock('@/features/campaigns/use-campaign-chat', () => ({
  useCampaignChat: () => ({
    messages: [],
    isOpen: false,
    busy: false,
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
    send: vi.fn(),
    abort: vi.fn(),
    clear: vi.fn(),
  }),
}))

import {
  getLiveCampaignDetail,
  getDbMetrics,
  getDeviceBreakdown,
  getHourlyBreakdown,
  getImpressionShare,
  getSearchTerms,
  getKeywordQualityScores,
  getKeywordPerformance,
} from '@/lib/api/campaigns'
import { getTenant } from '@/lib/api/tenants'
import { LiveCampaignRoute } from './$campaign_id'

const detail = {
  campaign: {
    id: 'c1',
    name: 'My Campaign',
    status: 'ENABLED',
    strategy: 'TARGET_CPA',
    budgetMicros: 50_000_000,
    metrics: {
      impressions: '100',
      clicks: '10',
      cost: '50',
      conversions: '5',
      cpa: '10',
      ctr: '10%',
      searchImpressionShare: '0.5',
    },
    history: [],
    adGroups: [],
  },
  wow: {
    cur: { impressions: 100, clicks: 10, cost: 50, conversions: 5 },
    prev: { impressions: 90, clicks: 9, cost: 45, conversions: 4 },
  },
  budgetPacing: null,
  client: { id: 'cl1' },
  openAlerts: [],
} as unknown as LiveCampaignDetail

describe('LiveCampaignRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getLiveCampaignDetail).mockResolvedValue(detail)
    vi.mocked(getDbMetrics).mockResolvedValue([])
    vi.mocked(getDeviceBreakdown).mockResolvedValue([])
    vi.mocked(getHourlyBreakdown).mockResolvedValue([])
    vi.mocked(getImpressionShare).mockResolvedValue(null as never)
    vi.mocked(getSearchTerms).mockResolvedValue([])
    vi.mocked(getKeywordQualityScores).mockResolvedValue([])
    vi.mocked(getKeywordPerformance).mockResolvedValue([])
    vi.mocked(getTenant).mockResolvedValue(null as never)
  })

  it('loads the live detail and renders the header + tab triggers', async () => {
    render(<LiveCampaignRoute />)

    await waitFor(() =>
      expect(getLiveCampaignDetail).toHaveBeenCalledWith('acme', 'c1', {}),
    )
    expect(await screen.findByText('My Campaign')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /headings\.live_performance/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'headings.campaign_history' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'headings.search_intelligence' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /headings\.ai_report/ })).toBeInTheDocument()
  })

  it('loads the campaign metrics history (180 days) on mount', async () => {
    render(<LiveCampaignRoute />)
    await waitFor(() => expect(getDbMetrics).toHaveBeenCalledWith('acme', 180, 'c1'))
  })
})
