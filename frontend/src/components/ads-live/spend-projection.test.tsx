import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
  }
})

import { SpendProjection } from './spend-projection'
import type { DbHistoryDay } from '@/lib/api/campaigns'

const makeDay = (
  date: string,
  over: Partial<DbHistoryDay> = {},
): DbHistoryDay => ({
  date,
  campaign_id: 'c1',
  cost: 0,
  conversions: 0,
  clicks: 0,
  impressions: 0,
  cpa: 0,
  ...over,
})

// two days in the current month
const currentMonth = new Date().toISOString().substring(0, 7)

describe('SpendProjection', () => {
  it('renders nothing when there are no rows in the current month', () => {
    const { container } = render(
      <SpendProjection history={[makeDay('2000-01-05', { cost: 10 })]} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('projects spend, conversions and cpa from current-month rows', () => {
    const history = [
      makeDay(`${currentMonth}-01`, { cost: 100, conversions: 2 }),
      makeDay(`${currentMonth}-02`, { cost: 100, conversions: 2 }),
    ]
    render(<SpendProjection history={history} />)
    // projection card title and the projected-spend value should appear
    expect(screen.getByText('analytics.projection_title')).toBeInTheDocument()
    // daily avg = 100, conversions avg = 2 → projectedCpa = 50 regardless of month length
    expect(screen.getByText('R$50.00')).toBeInTheDocument()
  })

  it('shows an em dash for cpa when there are no projected conversions', () => {
    const history = [
      makeDay(`${currentMonth}-01`, { cost: 50, conversions: 0 }),
    ]
    render(<SpendProjection history={history} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
