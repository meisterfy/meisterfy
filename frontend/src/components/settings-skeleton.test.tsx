import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import React from 'react'
import { SettingsSkeleton } from './settings-skeleton'

describe('SettingsSkeleton', () => {
  it('renders without crashing with default props', () => {
    const { container } = render(<SettingsSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders the table layout by default (twoPanel=false)', () => {
    render(<SettingsSkeleton rows={5} twoPanel={false} />)
    // The animate-pulse wrapper should be present
    const wrapper = document.querySelector('.animate-pulse')
    expect(wrapper).toBeInTheDocument()
  })

  it('renders the two-panel layout when twoPanel=true', () => {
    render(<SettingsSkeleton twoPanel={true} />)
    const wrapper = document.querySelector('.animate-pulse')
    expect(wrapper).toBeInTheDocument()
    // The two-panel layout has an lg:grid-cols-[260px_1fr] grid
    const grid = document.querySelector('.lg\\:grid-cols-\\[260px_1fr\\]')
    expect(grid).toBeInTheDocument()
  })

  it('uses 5 columns when rows > 3', () => {
    render(<SettingsSkeleton rows={8} />)
    // Header row and data rows should have 5 columns each
    const headerRow = document.querySelector(
      '[style="grid-template-columns: repeat(5, 1fr);"]',
    )
    expect(headerRow).toBeInTheDocument()
  })

  it('uses 4 columns when rows <= 3', () => {
    render(<SettingsSkeleton rows={3} />)
    const headerRow = document.querySelector(
      '[style="grid-template-columns: repeat(4, 1fr);"]',
    )
    expect(headerRow).toBeInTheDocument()
  })

  it('renders correct number of skeleton rows in table layout', () => {
    render(<SettingsSkeleton rows={5} />)
    // data rows: 5 rows × 5 cols = 25 cell divs inside the body rows
    // We check by looking at border-t rows (data rows, not the header)
    const dataRows = document.querySelectorAll('.grid.items-center.border-t')
    expect(dataRows).toHaveLength(5)
  })
})
