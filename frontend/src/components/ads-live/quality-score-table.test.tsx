import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: (_ns?: string) => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}))

import { QualityScoreTable } from './quality-score-table'
import type { KeywordQSRow } from '@/lib/api/campaigns'

const makeRow = (overrides: Partial<KeywordQSRow> = {}): KeywordQSRow => ({
  keywordText: 'shoes',
  matchType: 'EXACT',
  adGroupName: 'Group A',
  qualityScore: 8,
  creativeQS: 'ABOVE_AVERAGE',
  postClickQS: 'AVERAGE',
  predictedCTR: 'BELOW_AVERAGE',
  ...overrides,
})

describe('QualityScoreTable', () => {
  it('renders an empty state when there are no keywords', () => {
    render(<QualityScoreTable keywords={[]} />)
    expect(screen.getByText('analytics.quality_score_empty')).toBeInTheDocument()
  })

  it('sorts ascending by quality score', () => {
    render(
      <QualityScoreTable
        keywords={[
          makeRow({ keywordText: 'good', qualityScore: 9 }),
          makeRow({ keywordText: 'bad', qualityScore: 3 }),
        ]}
      />,
    )
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('bad')).toBeInTheDocument()
    expect(within(rows[1]).getByText('good')).toBeInTheDocument()
  })

  it('shows the action-needed warning with the count of low-QS keywords', () => {
    render(
      <QualityScoreTable
        keywords={[
          makeRow({ keywordText: 'a', qualityScore: 2 }),
          makeRow({ keywordText: 'b', qualityScore: 4 }),
          makeRow({ keywordText: 'c', qualityScore: 8 }),
        ]}
      />,
    )
    expect(
      screen.getByText('analytics.quality_score_action_needed:{"count":2}'),
    ).toBeInTheDocument()
  })

  it('does not warn when no keyword is below 5', () => {
    render(<QualityScoreTable keywords={[makeRow({ qualityScore: 7 })]} />)
    expect(
      screen.queryByText(/analytics.quality_score_action_needed/),
    ).not.toBeInTheDocument()
  })
})
