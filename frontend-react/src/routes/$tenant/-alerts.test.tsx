import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...original,
    createFileRoute: (_path: string) => (opts: { beforeLoad?: () => void; component: unknown }) => ({
      ...opts,
      useParams: () => ({ tenant: 'acme' }),
    }),
    redirect: original.redirect,
  }
})

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
  }
})

vi.mock('@/lib/api/pending-adjustments', () => ({
  listPendingAdjustments: vi.fn(),
  approvePendingAdjustment: vi.fn(),
  rejectPendingAdjustment: vi.fn(),
}))

import {
  listPendingAdjustments,
  approvePendingAdjustment,
  rejectPendingAdjustment,
} from '@/lib/api/pending-adjustments'
import type { PendingAdjustment } from '@/lib/api/pending-adjustments'
import { AlertsRoute } from './-alerts'

const makeAdj = (overrides: Partial<PendingAdjustment> = {}): PendingAdjustment => ({
  id: 'a1',
  tenant_id: 'acme',
  campaign_resource_id: 'camp-1',
  adjustment_type: 'bid_increase',
  current_value: 100,
  proposed_value: 120,
  reason: 'CPA is trending down',
  status: 'pending',
  created_at: '2026-06-01T00:00:00Z',
  expires_at: null,
  resolved_at: null,
  resolved_by: null,
  ...overrides,
})

describe('AlertsRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(approvePendingAdjustment).mockResolvedValue(undefined as never)
    vi.mocked(rejectPendingAdjustment).mockResolvedValue(undefined as never)
  })

  it('loads pending adjustments and renders the badge + reason', async () => {
    vi.mocked(listPendingAdjustments).mockResolvedValue([makeAdj()])
    render(<AlertsRoute />)

    await waitFor(() =>
      expect(listPendingAdjustments).toHaveBeenCalledWith('acme', 'pending'),
    )
    expect(await screen.findByText('↑ Bid +20%')).toBeInTheDocument()
    expect(screen.getByText('CPA is trending down')).toBeInTheDocument()
  })

  it('approves a suggestion via the confirm dialog and removes the card', async () => {
    const user = userEvent.setup()
    vi.mocked(listPendingAdjustments).mockResolvedValue([makeAdj({ id: 'a1' })])
    render(<AlertsRoute />)
    await waitFor(() => expect(screen.getByText('↑ Bid +20%')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /alerts\.approve/ }))
    // dialog now open — confirm button shares the label, it is the last match
    const confirmButtons = await screen.findAllByRole('button', { name: /alerts\.approve/ })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() =>
      expect(approvePendingAdjustment).toHaveBeenCalledWith('acme', 'a1'),
    )
    await waitFor(() => expect(screen.queryByText('↑ Bid +20%')).not.toBeInTheDocument())
  })

  it('shows the load-error banner when the fetch rejects', async () => {
    vi.mocked(listPendingAdjustments).mockRejectedValue(new Error('boom'))
    render(<AlertsRoute />)
    expect(await screen.findByText('alerts.error_load')).toBeInTheDocument()
  })
})
