import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { LiveCampaignDetail, SearchTermRow } from '@/lib/api/campaigns'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (k: string) => k }) }
})

import { SearchIntelligenceTab } from './search-intelligence-tab'

const nonSmartDetail = {
  campaign: { adGroups: [{ name: 'g1' }] },
} as unknown as LiveCampaignDetail

const term = {
  term: 'meisterfy',
  clicks: 10,
  cost: 20,
  conversions: 2,
  ctr: 0.1,
} as unknown as SearchTermRow

describe('SearchIntelligenceTab', () => {
  it('renders the search terms table when terms are present', () => {
    render(
      <SearchIntelligenceTab
        detail={nonSmartDetail}
        searchTerms={[term]}
        qualityScores={[]}
        keywords={[]}
      />,
    )
    expect(screen.getByText('meisterfy')).toBeInTheDocument()
  })

  it('shows the smart-campaign notice and hides keyword tables when smart-managed', () => {
    const smartDetail = {
      campaign: {
        adGroups: [{ name: 'Smart Campaign Managed AdGroup', metrics: { impressions: 0 } }],
      },
    } as unknown as LiveCampaignDetail
    render(
      <SearchIntelligenceTab
        detail={smartDetail}
        searchTerms={[]}
        qualityScores={[]}
        keywords={[]}
      />,
    )
    expect(screen.getByText('analytics.smart_campaign_no_keywords')).toBeInTheDocument()
  })
})
