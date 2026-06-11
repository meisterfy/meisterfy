import '@/lib/i18n/index'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublishDrawer } from './publish-drawer'
import type { PostShape } from '@/lib/social'
import type { ConnectorResource } from '@/lib/api/connector-resources'

vi.mock('@/lib/api/connector-resources', () => ({ publishToMeta: vi.fn() }))

import { publishToMeta } from '@/lib/api/connector-resources'

const makeDraft = (): PostShape => ({
  id: 'draft-7',
  status: 'approved',
  title: 'Publish me',
  content: 'Copy',
  hashtags: [],
  platform: ['instagram_feed'],
  client_id: 'acme',
  media_files: [],
  workflow: null,
})

const makeAccount = (overrides: Partial<ConnectorResource> = {}): ConnectorResource => ({
  id: 'acc-1',
  tenant_id: 'acme',
  integration_id: 'int-1',
  provider: 'meta',
  resource_type: 'page',
  resource_id: 'page-1',
  resource_name: 'My Page',
  metadata: { ig_username: 'mypage' },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('PublishDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(publishToMeta).mockResolvedValue({} as never)
  })

  it('shows the no-accounts warning and disables publish when there are no accounts', () => {
    render(
      <PublishDrawer
        open
        onOpenChange={vi.fn()}
        draft={makeDraft()}
        tenant="acme"
        metaAccounts={[]}
        onPublished={vi.fn()}
      />,
    )
    expect(screen.getByText('No Meta accounts found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Publish Now/ })).toBeDisabled()
  })

  it('lists accounts and enables publish when accounts exist', () => {
    render(
      <PublishDrawer
        open
        onOpenChange={vi.fn()}
        draft={makeDraft()}
        tenant="acme"
        metaAccounts={[makeAccount()]}
        onPublished={vi.fn()}
      />,
    )
    expect(screen.getByRole('option', { name: /My Page \(IG: mypage\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Publish Now/ })).toBeEnabled()
  })

  it('publishes to Meta (default IG account) then onPublished + close', async () => {
    const user = userEvent.setup()
    const onPublished = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <PublishDrawer
        open
        onOpenChange={onOpenChange}
        draft={makeDraft()}
        tenant="acme"
        metaAccounts={[makeAccount()]}
        onPublished={onPublished}
      />,
    )
    await user.click(screen.getByRole('button', { name: /Publish Now/ }))

    await waitFor(() => expect(publishToMeta).toHaveBeenCalledTimes(1))
    expect(publishToMeta).toHaveBeenCalledWith('acme', {
      post_id: 'draft-7',
      account_id: 'acc-1',
      platform: 'instagram',
    })
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith('draft-7'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the error message when publish fails', async () => {
    const user = userEvent.setup()
    vi.mocked(publishToMeta).mockRejectedValue(new Error('boom'))
    render(
      <PublishDrawer
        open
        onOpenChange={vi.fn()}
        draft={makeDraft()}
        tenant="acme"
        metaAccounts={[makeAccount()]}
        onPublished={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /Publish Now/ }))
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })
})
