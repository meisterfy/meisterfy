import '@/lib/i18n/index'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditPostDrawer } from './edit-post-drawer'
import type { PostShape } from '@/lib/social'

vi.mock('@/lib/api/posts', () => ({ updatePost: vi.fn(), deletePost: vi.fn() }))
vi.mock('@/lib/api/media', () => ({ uploadMedia: vi.fn(), deleteMedia: vi.fn() }))

import { updatePost, deletePost } from '@/lib/api/posts'

const makePost = (overrides: Partial<PostShape> = {}): PostShape => ({
  id: 'post-9',
  status: 'scheduled',
  title: 'Launch teaser',
  content: 'Coming soon',
  hashtags: ['launch', 'teaser'],
  scheduled_date: '2026-06-20',
  scheduled_time: '09:30',
  platform: ['instagram_feed', 'linkedin'],
  client_id: 'acme',
  media_files: [],
  workflow: null,
  ...overrides,
})

describe('EditPostDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(updatePost).mockResolvedValue({} as never)
    vi.mocked(deletePost).mockResolvedValue(undefined as never)
  })

  it('renders nothing meaningful when post is null', () => {
    render(
      <EditPostDrawer
        open
        onOpenChange={vi.fn()}
        post={null}
        tenant="acme"
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
  })

  it('populates the edit form from the post when open', () => {
    render(
      <EditPostDrawer
        open
        onOpenChange={vi.fn()}
        post={makePost()}
        tenant="acme"
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Title')).toHaveValue('Launch teaser')
    expect(screen.getByLabelText('Content')).toHaveValue('Coming soon')
    expect(screen.getByLabelText(/Hashtags/)).toHaveValue('launch teaser')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-06-20')
    expect(screen.getByText('post-9')).toBeInTheDocument()
  })

  it('saves edits and calls updatePost + onSaved + onOpenChange(false)', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <EditPostDrawer
        open
        onOpenChange={onOpenChange}
        post={makePost()}
        tenant="acme"
        onSaved={onSaved}
        onDeleted={vi.fn()}
      />,
    )
    const title = screen.getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'New title')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1))
    expect(updatePost).toHaveBeenCalledWith(
      'acme',
      'post-9',
      expect.objectContaining({ title: 'New title', hashtags: ['launch', 'teaser'] }),
    )
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onSaved.mock.calls[0][0]).toMatchObject({ id: 'post-9', title: 'New title' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('opens the delete confirm and deletes on confirm', async () => {
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    render(
      <EditPostDrawer
        open
        onOpenChange={vi.fn()}
        post={makePost()}
        tenant="acme"
        onSaved={vi.fn()}
        onDeleted={onDeleted}
      />,
    )
    await user.click(screen.getByRole('button', { name: /Delete/ }))
    expect(await screen.findByText('Delete post?')).toBeInTheDocument()

    // ConfirmDialog confirm button defaults to "Delete"
    const confirmButtons = screen.getAllByRole('button', { name: /^Delete$/ })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => expect(deletePost).toHaveBeenCalledWith('acme', 'post-9'))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('post-9'))
  })

  it('renders read-only view (no form, no delete) for a published post', () => {
    render(
      <EditPostDrawer
        open
        onOpenChange={vi.fn()}
        post={makePost({ status: 'published' })}
        tenant="acme"
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
    // content shown read-only (raw hashtag tokens, no '#')
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
    expect(screen.getByText('teaser')).toBeInTheDocument()
  })
})
