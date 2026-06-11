import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { NumberField } from './number-field'

describe('NumberField', () => {
  it('renders the label', () => {
    render(
      <NumberField
        id='test-field'
        label='Max Increase'
        suffix='%'
        value={20}
        onValueChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Max Increase')).toBeInTheDocument()
  })

  it('renders the suffix', () => {
    render(
      <NumberField
        id='test-field'
        label='Max Increase'
        suffix='%'
        value={20}
        onValueChange={vi.fn()}
      />,
    )
    expect(screen.getByText('%')).toBeInTheDocument()
  })

  it('associates label with input via htmlFor/id', () => {
    render(
      <NumberField
        id='test-field'
        label='Max Increase'
        suffix='%'
        value={20}
        onValueChange={vi.fn()}
      />,
    )
    const label = screen.getByText('Max Increase').closest('label')
    expect(label).toHaveAttribute('for', 'test-field')
  })

  it('calls onValueChange with numeric value when input changes', () => {
    const onValueChange = vi.fn()
    render(
      <NumberField
        id='test-field'
        label='Max Increase'
        suffix='%'
        value={20}
        onValueChange={onValueChange}
      />,
    )
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '42' } })
    expect(onValueChange).toHaveBeenCalledWith(42)
  })

  it('calls onValueChange with 0 when input is cleared', () => {
    const onValueChange = vi.fn()
    render(
      <NumberField
        id='test-field'
        label='Max Increase'
        suffix='%'
        value={20}
        onValueChange={onValueChange}
      />,
    )
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '' } })
    expect(onValueChange).toHaveBeenCalledWith(0)
  })

  it('renders the R$ suffix correctly', () => {
    render(
      <NumberField
        id='budget-field'
        label='Max Budget'
        suffix='R$'
        value={100}
        onValueChange={vi.fn()}
      />,
    )
    expect(screen.getByText('R$')).toBeInTheDocument()
  })

  it('applies max attribute to the input when provided', () => {
    render(
      <NumberField
        id='pct-field'
        label='Percentage'
        suffix='%'
        value={50}
        max={100}
        onValueChange={vi.fn()}
      />,
    )
    const input = screen.getByRole('spinbutton')
    expect(input).toHaveAttribute('max', '100')
  })
})
