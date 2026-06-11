import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
  }
})

import { PerformanceExtremes } from './performance-extremes'
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

describe('PerformanceExtremes', () => {
  it('shows the empty state when fewer than 10 days have conversions', () => {
    const history = Array.from({ length: 5 }, (_, i) =>
      makeDay(`2026-01-0${i + 1}`, { conversions: 1, cpa: i + 1 }),
    )
    render(<PerformanceExtremes history={history} />)
    expect(screen.getByText('analytics.no_conversion_data')).toBeInTheDocument()
    expect(screen.queryByText('analytics.best_days')).not.toBeInTheDocument()
  })

  it('renders best and worst day columns when enough data exists', () => {
    const history = Array.from({ length: 12 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0')
      return makeDay(`2026-01-${day}`, { conversions: 3, cpa: i + 1 })
    })
    render(<PerformanceExtremes history={history} />)
    expect(screen.getByText('analytics.best_days')).toBeInTheDocument()
    expect(screen.getByText('analytics.worst_days')).toBeInTheDocument()
    // best day = lowest cpa = 1 → R$1.00; worst day = highest cpa = 12 → R$12.00
    expect(screen.getByText('R$1.00')).toBeInTheDocument()
    expect(screen.getByText('R$12.00')).toBeInTheDocument()
    // ddmm formatting: 2026-01-01 → 01/01
    expect(screen.getByText('01/01')).toBeInTheDocument()
  })

  it('reports the longest dry streak', () => {
    // 12 converting days (so extremes render) then 3 zero-conversion days
    const converting = Array.from({ length: 12 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0')
      return makeDay(`2026-01-${day}`, { conversions: 1, cpa: i + 1 })
    })
    const dry = ['2026-02-01', '2026-02-02', '2026-02-03'].map((d) =>
      makeDay(d, { conversions: 0 }),
    )
    render(<PerformanceExtremes history={[...converting, ...dry]} />)
    expect(screen.getByText('analytics.dry_streak')).toBeInTheDocument()
  })
})
