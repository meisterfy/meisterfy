import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MultiSelect } from './multi-select'

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
]

describe('MultiSelect', () => {
  it('renders trigger with placeholder when value is empty', () => {
    render(
      <MultiSelect
        options={options}
        value={[]}
        onChange={vi.fn()}
        placeholder="Pick one"
      />,
    )
    expect(screen.getByText('Pick one')).toBeInTheDocument()
  })

  it('calls onChange with the selected value when an option is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MultiSelect options={options} value={[]} onChange={onChange} />)

    // open the popover
    await user.click(screen.getByRole('button', { name: /select…/i }))

    // click option A
    await user.click(screen.getByRole('button', { name: /^a$/i }))

    expect(onChange).toHaveBeenCalledWith(['a'])
  })

  it('calls onChange with value removed when an already-selected option is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MultiSelect options={options} value={['a', 'b']} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /a.*b/i }))
    await user.click(screen.getByRole('button', { name: /^a$/i }))

    expect(onChange).toHaveBeenCalledWith(['b'])
  })

  it('shows selected labels as chips on the trigger', () => {
    render(
      <MultiSelect options={options} value={['a']} onChange={vi.fn()} />,
    )
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('shows no-options message when search matches nothing', async () => {
    const user = userEvent.setup()
    render(
      <MultiSelect
        options={options}
        value={[]}
        onChange={vi.fn()}
        emptyLabel="Nothing here"
      />,
    )
    await user.click(screen.getByRole('button', { name: /select…/i }))
    await user.type(screen.getByPlaceholderText(/search/i), 'zzz')
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })
})
