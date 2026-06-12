import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
}))

import { MonthlyTable } from './monthly-table'
import type { DbHistoryDay } from '@/lib/api/campaigns'

const makeDay = (overrides: Partial<DbHistoryDay> = {}): DbHistoryDay => ({
  date: '2026-01-01',
  campaign_id: 'c1',
  cost: 10,
  conversions: 1,
  clicks: 5,
  impressions: 100,
  cpa: 10,
  ...overrides,
})

describe('MonthlyTable', () => {
  it('groups days into months and renders them most-recent first', () => {
    render(
      <MonthlyTable
        history={[
          makeDay({ date: '2026-01-10' }),
          makeDay({ date: '2026-02-10' }),
          makeDay({ date: '2026-01-20' }),
        ]}
      />,
    )
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('2026-02')).toBeInTheDocument()
    expect(within(rows[1]).getByText('2026-01')).toBeInTheDocument()
  })

  it('aggregates cost and active days per month', () => {
    render(
      <MonthlyTable
        history={[
          makeDay({ date: '2026-03-01', cost: 5, impressions: 10 }),
          makeDay({ date: '2026-03-02', cost: 15, impressions: 0 }),
        ]}
      />,
    )
    const row = screen.getByText('2026-03').closest('tr')!
    expect(within(row).getByText('R$20.00')).toBeInTheDocument()
    // activeDays = 1 (only the day with impressions > 0)
    expect(within(row).getByText('1')).toBeInTheDocument()
  })

  it('renders an empty table body for no history', () => {
    render(<MonthlyTable history={[]} />)
    // only the header row remains
    expect(screen.getAllByRole('row')).toHaveLength(1)
  })
})
