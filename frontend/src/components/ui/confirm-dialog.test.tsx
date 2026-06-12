import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ConfirmDialog } from './confirm-dialog'

describe('ConfirmDialog', () => {
  it('renders title and description when open', async () => {
    render(
      <ConfirmDialog
        open
        onConfirm={vi.fn()}
        title="Delete item"
        description="This cannot be undone."
      />,
    )
    expect(await screen.findByText('Delete item')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDialog open onConfirm={onConfirm} />)

    await user.click(await screen.findByRole('button', { name: /^delete$/i }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('confirm button is disabled and shows loading text when isLoading', async () => {
    render(<ConfirmDialog open onConfirm={vi.fn()} isLoading />)

    const btn = await screen.findByRole('button', { name: /deleting/i })
    expect(btn).toBeDisabled()
  })

  it('uses default props when none are provided', async () => {
    render(<ConfirmDialog open onConfirm={vi.fn()} />)

    expect(await screen.findByText('Are you sure?')).toBeInTheDocument()
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
  })

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog open onConfirm={vi.fn()} onOpenChange={onOpenChange} />,
    )

    await user.click(await screen.findByRole('button', { name: /^cancel$/i }))

    // base-ui passes (open, event) — assert only on the first argument
    expect(onOpenChange).toHaveBeenCalled()
    expect(onOpenChange.mock.calls[0][0]).toBe(false)
  })
})
