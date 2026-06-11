import '@/lib/i18n/index'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScheduleDrawer } from './schedule-drawer'
import type { PostShape } from '@/lib/social'

vi.mock('@/lib/api/posts', () => ({ updatePost: vi.fn(), updatePostStatus: vi.fn() }))
vi.mock('@/lib/api/social-accounts', () => ({ getConnectedMetaPages: vi.fn() }))

import { updatePost, updatePostStatus } from '@/lib/api/posts'
import { getConnectedMetaPages } from '@/lib/api/social-accounts'

const makeDraft = (overrides: Partial<PostShape> = {}): PostShape => ({
  id: 'draft-5',
  status: 'approved',
  title: 'Ready post',
  content: 'Copy',
  hashtags: [],
  platform: ['linkedin'],
  client_id: 'acme',
  media_files: [],
  workflow: null,
  connector_resource_id: null,
  ...overrides,
})

describe('ScheduleDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getConnectedMetaPages).mockResolvedValue([])
    vi.mocked(updatePost).mockResolvedValue({} as never)
    vi.mocked(updatePostStatus).mockResolvedValue({} as never)
  })

  it('renders nothing when draft is null', () => {
    render(
      <ScheduleDrawer
        open
        onOpenChange={vi.fn()}
        draft={null}
        tenant="acme"
        onScheduled={vi.fn()}
      />,
    )
    expect(screen.queryByText('Add to Planner')).not.toBeInTheDocument()
  })

  it('shows the draft title and keeps submit disabled until a date is picked', async () => {
    const user = userEvent.setup()
    render(
      <ScheduleDrawer
        open
        onOpenChange={vi.fn()}
        draft={makeDraft()}
        tenant="acme"
        onScheduled={vi.fn()}
      />,
    )
    expect(screen.getByText('Ready post')).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /Add to Planner/ })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Date'), '2026-07-01')
    expect(submit).toBeEnabled()
  })

  it('schedules: updatePost then updatePostStatus(scheduled) + onScheduled + close', async () => {
    const user = userEvent.setup()
    const onScheduled = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ScheduleDrawer
        open
        onOpenChange={onOpenChange}
        draft={makeDraft()}
        tenant="acme"
        onScheduled={onScheduled}
      />,
    )
    await user.type(screen.getByLabelText('Date'), '2026-07-01')
    await user.click(screen.getByRole('button', { name: /Add to Planner/ }))

    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1))
    expect(updatePost).toHaveBeenCalledWith(
      'acme',
      'draft-5',
      expect.objectContaining({ platforms: ['linkedin'], connector_resource_id: null }),
    )
    await waitFor(() => expect(updatePostStatus).toHaveBeenCalledTimes(1))
    expect(updatePostStatus).toHaveBeenCalledWith(
      'acme',
      'draft-5',
      'scheduled',
      expect.objectContaining({ scheduled_date: '2026-07-01', scheduled_time: '10:00' }),
    )
    await waitFor(() => expect(onScheduled).toHaveBeenCalledWith('draft-5'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
