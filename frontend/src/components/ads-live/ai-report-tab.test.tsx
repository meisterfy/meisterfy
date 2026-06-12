import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { LiveCampaignDetail } from '@/lib/api/campaigns'
import type { BrandContext } from '@/lib/ai/campaign-context'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (k: string) => k }) }
})
vi.mock('@/lib/api/ai', () => ({ getAIProviders: vi.fn(), streamGenerate: vi.fn() }))
vi.mock('@/lib/api/ai-reports', () => ({ listAIReports: vi.fn(), saveAIReport: vi.fn() }))

import { getAIProviders, streamGenerate } from '@/lib/api/ai'
import { listAIReports, saveAIReport } from '@/lib/api/ai-reports'
import { AiReportTab } from './ai-report-tab'

const brand: BrandContext = {
  name: 'Acme',
  niche: null,
  location: null,
  primary_persona: null,
  tone: null,
  instructions: null,
  report_prompts: null,
}
const detail = {
  campaign: {
    name: 'Camp',
    status: 'ENABLED',
    strategy: 'TARGET_CPA',
    budgetMicros: 50_000_000,
    metrics: {
      impressions: '100',
      clicks: '10',
      cost: '50',
      cpa: '5',
      conversions: '10',
      searchImpressionShare: '0.5',
    },
  },
} as unknown as LiveCampaignDetail

const props = {
  tenant: 'acme',
  campaignId: 'c1',
  brand,
  detail,
  searchTerms: [],
  keywords: [],
  qualityScores: [],
}

describe('AiReportTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listAIReports).mockResolvedValue([])
  })

  it('shows the no-provider warning and disables generate', async () => {
    vi.mocked(getAIProviders).mockResolvedValue([])
    render(<AiReportTab {...props} />)
    expect(await screen.findByText('analytics.ai_no_provider')).toBeInTheDocument()
  })

  it('shows the empty CTA when a provider is available but no report yet', async () => {
    vi.mocked(getAIProviders).mockResolvedValue([{ name: 'claude' }] as never)
    render(<AiReportTab {...props} />)
    expect(await screen.findByText('analytics.ai_title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /analytics\.ai_generate/ })).toBeEnabled()
  })

  it('generates a report: streams markdown then saves it', async () => {
    const user = userEvent.setup()
    vi.mocked(getAIProviders).mockResolvedValue([{ name: 'claude' }] as never)
    vi.mocked(streamGenerate).mockImplementation(async (_req, onChunk) => {
      onChunk({ content: '# Heading', done: false })
    })
    vi.mocked(saveAIReport).mockResolvedValue({
      id: 'r1',
      content: '# Heading',
      generated_at: '2026-06-11T00:00:00Z',
      model: 'claude',
    } as never)

    render(<AiReportTab {...props} />)
    await screen.findByText('analytics.ai_title')
    await user.click(screen.getByRole('button', { name: /analytics\.ai_generate/ }))

    await waitFor(() => expect(streamGenerate).toHaveBeenCalledTimes(1))
    const req = vi.mocked(streamGenerate).mock.calls[0][0]
    expect(req.task_type).toBe('campaign_report')
    expect(req.provider).toBe('claude')
    expect(req.system).toContain('CAMPAIGN DATA (today):')
    await waitFor(() =>
      expect(saveAIReport).toHaveBeenCalledWith('acme', 'c1', {
        content: '# Heading',
        report_type: 'instant',
        model: 'claude',
      }),
    )
    expect(await screen.findByText('Heading')).toBeInTheDocument()
  })
})
