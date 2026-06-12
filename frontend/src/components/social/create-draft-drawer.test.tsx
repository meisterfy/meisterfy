import '@/lib/i18n/index'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateDraftDrawer } from './create-draft-drawer'
import type { Post } from '@/lib/api/posts'

vi.mock('@/lib/api/posts', () => ({ createPost: vi.fn() }))
vi.mock('@/lib/api/media', () => ({ uploadMedia: vi.fn() }))

import { createPost } from '@/lib/api/posts'

const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: 'draft-1',
  tenant_id: 'acme',
  status: 'draft',
  title: 'Draft title',
  content: 'Draft body',
  hashtags: [],
  media_type: null,
  media_path: null,
  platforms: [],
  connector_resource_id: null,
  workflow: null,
  scheduled_date: null,
  scheduled_time: null,
  published_at: null,
  created_at: '2026-06-11T00:00:00Z',
  updated_at: '2026-06-11T00:00:00Z',
  ...overrides,
})

describe('CreateDraftDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createPost).mockResolvedValue(makePost())
  })

  it('renders the new-draft title when open', () => {
    render(<CreateDraftDrawer open onOpenChange={vi.fn()} tenant="acme" onCreated={vi.fn()} />)
    expect(screen.getAllByRole('heading', { name: 'New Draft' }).length).toBeGreaterThan(0)
  })

  it('keeps the submit button disabled until title and content are filled', async () => {
    const user = userEvent.setup()
    render(<CreateDraftDrawer open onOpenChange={vi.fn()} tenant="acme" onCreated={vi.fn()} />)
    const submit = screen.getByRole('button', { name: /Create Draft/ })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Title'), 'My draft')
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Content'), 'Body text')
    expect(submit).toBeEnabled()
  })

  it('creates a draft (status draft) and calls onCreated + onOpenChange(false)', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <CreateDraftDrawer
        open
        onOpenChange={onOpenChange}
        tenant="acme"
        onCreated={onCreated}
      />,
    )
    await user.type(screen.getByLabelText('Title'), 'My draft')
    await user.type(screen.getByLabelText('Content'), 'Body text')
    await user.type(screen.getByLabelText(/Hashtags/), '#a #b')
    await user.click(screen.getByRole('button', { name: /Create Draft/ }))

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1))
    expect(createPost).toHaveBeenCalledWith(
      'acme',
      expect.objectContaining({
        title: 'My draft',
        content: 'Body text',
        status: 'draft',
        hashtags: ['a', 'b'],
      }),
    )
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    expect(onCreated.mock.calls[0][0]).toMatchObject({ id: 'draft-1', media_files: [] })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
