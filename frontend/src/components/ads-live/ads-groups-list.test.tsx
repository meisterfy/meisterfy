import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
}))

import { AdsGroupsList } from './ads-groups-list'
import type { AdGroup } from '@/lib/api/campaigns'

const makeGroup = (overrides: Partial<AdGroup> = {}): AdGroup => ({
  id: 'g1',
  name: 'Group A',
  status: 'ENABLED',
  metrics: { impressions: 100, clicks: 10, cost: 'R$50.00', conversions: 2 },
  ...overrides,
})

describe('AdsGroupsList', () => {
  it('renders a row per ad group with its metrics', () => {
    render(<AdsGroupsList adGroups={[makeGroup({ name: 'Brand' }), makeGroup({ name: 'Generic' })]} />)
    expect(screen.getByText('Brand')).toBeInTheDocument()
    expect(screen.getByText('Generic')).toBeInTheDocument()
    const brandRow = screen.getByText('Brand').closest('tr')!
    expect(within(brandRow).getByText('100')).toBeInTheDocument()
    expect(within(brandRow).getByText('R$50.00')).toBeInTheDocument()
  })

  it('shows the empty state when there are no ad groups', () => {
    render(<AdsGroupsList adGroups={[]} />)
    expect(screen.getByText('messages.no_ad_groups_found')).toBeInTheDocument()
  })

  it('defaults adGroups to an empty list when prop is omitted', () => {
    render(<AdsGroupsList />)
    expect(screen.getByText('messages.no_ad_groups_found')).toBeInTheDocument()
  })
})
