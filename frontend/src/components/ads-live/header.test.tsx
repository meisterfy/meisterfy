import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type React from 'react'
import type { LiveCampaignDetail } from '@/lib/api/campaigns'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (k: string) => k }) }
})

import { LiveHeader } from './header'

const detail = {
  campaign: { id: 'c1', name: 'My Campaign', status: 'ENABLED', strategy: 'TARGET_CPA' },
  client: { id: 'cl1' },
} as unknown as LiveCampaignDetail

describe('LiveHeader', () => {
  it('renders the campaign name, id and active status', () => {
    render(
      <LiveHeader
        detail={detail}
        tenant="acme"
        campaignId="c1"
        actions={{ syncing: false, exporting: false, runSyncHistory: vi.fn(), exportReport: vi.fn() }}
      />,
    )
    expect(screen.getByText('My Campaign')).toBeInTheDocument()
    expect(screen.getByText('ID: c1')).toBeInTheDocument()
    expect(screen.getByText('status.active')).toBeInTheDocument()
  })

  it('wires sync and export actions', async () => {
    const user = userEvent.setup()
    const runSyncHistory = vi.fn()
    const exportReport = vi.fn()
    render(
      <LiveHeader
        detail={detail}
        tenant="acme"
        campaignId="c1"
        actions={{ syncing: false, exporting: false, runSyncHistory, exportReport }}
      />,
    )
    await user.click(screen.getByRole('button', { name: /sync/ }))
    expect(runSyncHistory).toHaveBeenCalledWith('acme')
    await user.click(screen.getByRole('button', { name: /ia_export/ }))
    expect(exportReport).toHaveBeenCalledWith('c1', 'cl1')
  })
})
