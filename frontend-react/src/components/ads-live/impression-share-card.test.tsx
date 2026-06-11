import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
  }
})

import { ImpressionShareCard } from './impression-share-card'

describe('ImpressionShareCard', () => {
  it('renders nothing when stats is null', () => {
    const { container } = render(<ImpressionShareCard stats={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the three share percentages', () => {
    render(
      <ImpressionShareCard
        stats={{ wonShare: 0.6, lostBudget: 0.1, lostRank: 0.3 }}
      />,
    )
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('shows the budget warning when lostBudget exceeds threshold', () => {
    render(
      <ImpressionShareCard
        stats={{ wonShare: 0.5, lostBudget: 0.2, lostRank: 0.1 }}
      />,
    )
    expect(
      screen.getByText('analytics.impression_share_budget_warning'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('analytics.impression_share_rank_warning'),
    ).not.toBeInTheDocument()
  })

  it('shows the rank warning when lostRank exceeds threshold', () => {
    render(
      <ImpressionShareCard
        stats={{ wonShare: 0.5, lostBudget: 0.1, lostRank: 0.2 }}
      />,
    )
    expect(
      screen.getByText('analytics.impression_share_rank_warning'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('analytics.impression_share_budget_warning'),
    ).not.toBeInTheDocument()
  })
})
