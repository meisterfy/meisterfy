import '@/lib/i18n/index'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NewPostDrawer } from './new-post-drawer'
import type { Post } from '@/lib/api/posts'

vi.mock('@/lib/api/posts', () => ({ createPost: vi.fn() }))
vi.mock('@/lib/api/media', () => ({ uploadMedia: vi.fn() }))
vi.mock('@/lib/api/social-accounts', () => ({ getConnectedMetaPages: vi.fn() }))

import { createPost } from '@/lib/api/posts'
import { uploadMedia } from '@/lib/api/media'
import { getConnectedMetaPages } from '@/lib/api/social-accounts'

const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: 'post-1',
  tenant_id: 'acme',
  status: 'scheduled',
  title: 'Hello',
  content: 'Body',
  hashtags: [],
  media_type: null,
  media_path: null,
  platforms: ['instagram_feed'],
  connector_resource_id: null,
  workflow: null,
  scheduled_date: '2026-06-15',
  scheduled_time: '10:00',
  published_at: null,
  created_at: '2026-06-11T00:00:00Z',
  updated_at: '2026-06-11T00:00:00Z',
  ...overrides,
})

describe('NewPostDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getConnectedMetaPages).mockResolvedValue([])
    vi.mocked(createPost).mockResolvedValue(makePost())
    vi.mocked(uploadMedia).mockResolvedValue([])
  })

  it('renders the title and the fixed default date when open', async () => {
    render(
      <NewPostDrawer
        open
        onOpenChange={vi.fn()}
        tenant="acme"
        defaultDate="2026-06-15"
        onCreated={vi.fn()}
      />,
    )
    // both the sr-only Dialog.Title and the visible h2 are named "New Post"
    expect(screen.getAllByRole('heading', { name: 'New Post' }).length).toBeGreaterThan(0)
    expect(screen.getByText('2026-06-15')).toBeInTheDocument()
    await waitFor(() => expect(getConnectedMetaPages).toHaveBeenCalledWith('acme'))
  })

  it('shows the meta-account select when connected pages are returned', async () => {
    vi.mocked(getConnectedMetaPages).mockResolvedValue([
      { id: 'mp-1', resource_name: 'My Page', metadata: { ig_username: 'mypage' } },
    ])
    render(
      <NewPostDrawer
        open
        onOpenChange={vi.fn()}
        tenant="acme"
        defaultDate="2026-06-15"
        onCreated={vi.fn()}
      />,
    )
    await waitFor(() => expect(screen.getByText('My Page (@mypage)')).toBeInTheDocument())
  })

  it('shows the connect hint when no pages are returned', async () => {
    render(
      <NewPostDrawer
        open
        onOpenChange={vi.fn()}
        tenant="acme"
        defaultDate="2026-06-15"
        onCreated={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(
        screen.getByText(/Connect a Meta account in Settings → Social/),
      ).toBeInTheDocument(),
    )
  })

  it('keeps the submit button disabled until title and content are filled', async () => {
    const user = userEvent.setup()
    render(
      <NewPostDrawer
        open
        onOpenChange={vi.fn()}
        tenant="acme"
        defaultDate="2026-06-15"
        onCreated={vi.fn()}
      />,
    )
    const submit = screen.getByRole('button', { name: /Add to Planner/ })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Title'), 'My title')
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Content'), 'My content')
    expect(submit).toBeEnabled()
  })

  it('creates the post and calls onCreated + onOpenChange(false) on submit', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <NewPostDrawer
        open
        onOpenChange={onOpenChange}
        tenant="acme"
        defaultDate="2026-06-15"
        onCreated={onCreated}
      />,
    )

    await user.type(screen.getByLabelText('Title'), 'My title')
    await user.type(screen.getByLabelText('Content'), 'My content')
    await user.click(screen.getByRole('button', { name: /Add to Planner/ }))

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1))
    expect(createPost).toHaveBeenCalledWith(
      'acme',
      expect.objectContaining({
        title: 'My title',
        content: 'My content',
        status: 'scheduled',
        scheduled_date: '2026-06-15',
        platforms: ['instagram_feed'],
      }),
    )
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    expect(onCreated.mock.calls[0][0]).toMatchObject({ id: 'post-1', media_files: [] })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('parses hashtags into an array on submit', async () => {
    const user = userEvent.setup()
    render(
      <NewPostDrawer
        open
        onOpenChange={vi.fn()}
        tenant="acme"
        defaultDate="2026-06-15"
        onCreated={vi.fn()}
      />,
    )
    await user.type(screen.getByLabelText('Title'), 'T')
    await user.type(screen.getByLabelText('Content'), 'C')
    await user.type(screen.getByLabelText(/Hashtags/), '#one #two')
    await user.click(screen.getByRole('button', { name: /Add to Planner/ }))

    await waitFor(() =>
      expect(createPost).toHaveBeenCalledWith(
        'acme',
        expect.objectContaining({ hashtags: ['one', 'two'] }),
      ),
    )
  })
})
