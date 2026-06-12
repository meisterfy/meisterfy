import { render, screen, within, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
}))

import { SearchTermsTable } from './search-terms-table'
import type { SearchTermRow } from '@/lib/api/campaigns'

const makeRow = (overrides: Partial<SearchTermRow> = {}): SearchTermRow => ({
  term: 'a term',
  status: 'NONE',
  clicks: 5,
  impressions: 50,
  cost: 10,
  conversions: 0,
  cpa: 0,
  ctr: 10,
  ...overrides,
})

describe('SearchTermsTable', () => {
  it('renders an empty state when there are no terms', () => {
    render(<SearchTermsTable terms={[]} />)
    expect(screen.getByText('analytics.search_terms_empty')).toBeInTheDocument()
  })

  it('shows converting terms sorted by conversions desc', () => {
    render(
      <SearchTermsTable
        terms={[
          makeRow({ term: 'one conv', conversions: 1, cost: 5 }),
          makeRow({ term: 'three conv', conversions: 3, cost: 5 }),
        ]}
      />,
    )
    const section = screen.getByText('analytics.search_terms_converting').closest('section')!
    const rows = within(section).getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('three conv')).toBeInTheDocument()
    expect(within(rows[1]).getByText('one conv')).toBeInTheDocument()
  })

  it('lists wasted terms (no conversions, above-average cost) capped at 20', () => {
    // avgCost across all = (200 + 0*many)/N. Make one expensive non-converting term.
    const terms = [
      makeRow({ term: 'expensive waste', conversions: 0, cost: 200 }),
      makeRow({ term: 'cheap', conversions: 0, cost: 1 }),
    ]
    render(<SearchTermsTable terms={terms} />)
    const section = screen.getByText('analytics.search_terms_wasted').closest('section')!
    expect(within(section).getByText('expensive waste')).toBeInTheDocument()
    expect(within(section).queryByText('cheap')).not.toBeInTheDocument()
  })

  describe('copy as CSV', () => {
    it('copies the wasted terms to the clipboard as CSV', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      })
      render(
        <SearchTermsTable
          terms={[
            makeRow({ term: 'waste', conversions: 0, cost: 200 }),
            makeRow({ term: 'cheap', conversions: 0, cost: 1 }),
          ]}
        />,
      )
      // fireEvent avoids userEvent replacing navigator.clipboard with its own stub
      fireEvent.click(screen.getByText('analytics.search_terms_copy_csv'))
      expect(writeText).toHaveBeenCalledWith('Term,Cost,Clicks\n"waste",R$200.00,5')
      expect(await screen.findByText('analytics.search_terms_copied')).toBeInTheDocument()
    })
  })
})
