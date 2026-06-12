import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
}))

import { KeywordPerformanceTable } from './keyword-performance-table'
import type { KeywordPerfRow } from '@/lib/api/campaigns'

const makeRow = (overrides: Partial<KeywordPerfRow> = {}): KeywordPerfRow => ({
  keywordText: 'shoes',
  matchType: 'EXACT',
  adGroupName: 'Group A',
  clicks: 10,
  impressions: 100,
  cost: 50,
  conversions: 2,
  cpa: 25,
  ctr: 10,
  ...overrides,
})

describe('KeywordPerformanceTable', () => {
  it('renders an empty state when there are no keywords', () => {
    render(<KeywordPerformanceTable keywords={[]} />)
    expect(screen.getByText('analytics.keywords_empty')).toBeInTheDocument()
  })

  it('renders rows sorted by cost descending by default', () => {
    render(
      <KeywordPerformanceTable
        keywords={[
          makeRow({ keywordText: 'cheap', cost: 10 }),
          makeRow({ keywordText: 'pricey', cost: 100 }),
        ]}
      />,
    )
    const rows = screen.getAllByRole('row').slice(1) // skip header
    expect(within(rows[0]).getByText('pricey')).toBeInTheDocument()
    expect(within(rows[1]).getByText('cheap')).toBeInTheDocument()
  })

  it('filters rows by keyword text', async () => {
    const user = userEvent.setup()
    render(
      <KeywordPerformanceTable
        keywords={[
          makeRow({ keywordText: 'running shoes' }),
          makeRow({ keywordText: 'blue hat' }),
        ]}
      />,
    )
    expect(screen.getByText('running shoes')).toBeInTheDocument()
    expect(screen.getByText('blue hat')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('analytics.keywords_filter_placeholder'), 'hat')

    expect(screen.queryByText('running shoes')).not.toBeInTheDocument()
    expect(screen.getByText('blue hat')).toBeInTheDocument()
  })

  it('renders the match-type badge label', () => {
    render(<KeywordPerformanceTable keywords={[makeRow({ matchType: 'BROAD' })]} />)
    expect(screen.getByText('analytics.match_broad')).toBeInTheDocument()
  })
})
