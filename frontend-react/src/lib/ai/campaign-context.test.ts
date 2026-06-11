import { describe, it, expect } from 'vitest'
import type {
  LiveCampaignDetail,
  SearchTermRow,
  KeywordPerfRow,
  KeywordQSRow,
} from '@/lib/api/campaigns'
import { buildCampaignData, buildChatSystemPrompt, type BrandContext } from './campaign-context'

const detail = {
  campaign: {
    id: 'c1',
    name: 'Brand Search',
    status: 'ENABLED',
    strategy: 'maximize_conversions',
    budgetMicros: 50_000_000,
    metrics: {
      impressions: '1000',
      clicks: '50',
      cost: '120.00',
      cpa: '12.00',
      conversions: '10',
      searchImpressionShare: '0.65',
    },
  },
} as unknown as LiveCampaignDetail

const terms = [
  { term: 'meisterfy', clicks: 30, cost: 40, conversions: 5, ctr: 0.1 },
] as unknown as SearchTermRow[]
const kw = [
  {
    matchType: 'EXACT',
    keywordText: 'meisterfy app',
    adGroupName: 'Brand',
    cost: 60,
    cpa: 12,
    conversions: 5,
  },
] as unknown as KeywordPerfRow[]
const qs = [
  {
    keywordText: 'cheap thing',
    qualityScore: 3,
    predictedCTR: 'BELOW_AVERAGE',
    creativeQS: 'AVERAGE',
    postClickQS: 'ABOVE_AVERAGE',
  },
] as unknown as KeywordQSRow[]

describe('buildCampaignData', () => {
  it('renders the campaign header, metrics and top tables', () => {
    const out = buildCampaignData(detail, terms, kw, qs)
    expect(out).toContain('Campaign: Brand Search')
    expect(out).toContain('Budget: R$50.00/day')
    expect(out).toContain('"meisterfy"')
    expect(out).toContain('[EXACT] "meisterfy app"')
    expect(out).toContain('QS: 3/10')
  })

  it('shows placeholders when sections are empty', () => {
    const out = buildCampaignData(detail, [], [], [])
    expect(out).toContain('(none)')
    expect(out).toContain('(none found)')
  })
})

describe('buildChatSystemPrompt', () => {
  it('appends the campaign data block to the resolved instant prompt', () => {
    const brand: BrandContext = {
      name: 'Acme',
      niche: null,
      location: null,
      primary_persona: null,
      tone: null,
      instructions: null,
      report_prompts: null,
    }
    const out = buildChatSystemPrompt(brand, 'CAMP_DATA')
    expect(out).toContain('CAMPAIGN DATA (today):')
    expect(out).toContain('CAMP_DATA')
  })
})
