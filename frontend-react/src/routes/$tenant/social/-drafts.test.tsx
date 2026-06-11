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

vi.mock('@/lib/api/posts', () => ({
  getPosts: vi.fn(),
  updatePostStatus: vi.fn(),
  deletePost: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
}))
vi.mock('@/lib/api/connector-resources', () => ({
  getConnectorResources: vi.fn(),
  publishToMeta: vi.fn(),
}))
vi.mock('@/lib/api/media', () => ({ uploadMedia: vi.fn(), deleteMedia: vi.fn() }))
vi.mock('@/lib/api/social-accounts', () => ({ getConnectedMetaPages: vi.fn() }))
vi.mock('@/lib/api/ai', () => ({ getAIProviders: vi.fn(), streamGenerate: vi.fn() }))

import { getPosts, updatePostStatus } from '@/lib/api/posts'
import { getConnectorResources } from '@/lib/api/connector-resources'
import type { Post } from '@/lib/api/posts'
import { DraftsRoute } from './-drafts'

const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: 'd1',
  tenant_id: 'acme',
  status: 'draft',
  title: 'My draft',
  content: 'Body',
  hashtags: [],
  media_type: null,
  media_path: null,
  platforms: ['instagram_feed'],
  connector_resource_id: null,
  workflow: null,
  scheduled_date: null,
  scheduled_time: null,
  published_at: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  ...overrides,
})

describe('DraftsRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getConnectorResources).mockResolvedValue([])
    vi.mocked(updatePostStatus).mockResolvedValue({} as never)
  })

  it('loads draft|approved posts and renders them, filtering out other statuses', async () => {
    vi.mocked(getPosts).mockResolvedValue([
      makePost({ id: 'd1', title: 'A draft', status: 'draft' }),
      makePost({ id: 'd2', title: 'An approved', status: 'approved' }),
      makePost({ id: 'd3', title: 'A scheduled', status: 'scheduled' }),
    ])
    render(<DraftsRoute />)

    await waitFor(() => expect(getPosts).toHaveBeenCalledWith('acme'))
    await waitFor(() => expect(screen.getByText('A draft')).toBeInTheDocument())
    expect(screen.getByText('An approved')).toBeInTheDocument()
    expect(screen.queryByText('A scheduled')).not.toBeInTheDocument()
  })

  it('shows the empty state when there are no drafts', async () => {
    vi.mocked(getPosts).mockResolvedValue([])
    render(<DraftsRoute />)
    await waitFor(() => expect(getPosts).toHaveBeenCalledWith('acme'))
    expect(screen.getByText('no_drafts_yet')).toBeInTheDocument()
  })

  it('toggles approval via updatePostStatus and updates the row', async () => {
    const user = userEvent.setup()
    vi.mocked(getPosts).mockResolvedValue([makePost({ id: 'd1', status: 'draft' })])
    render(<DraftsRoute />)
    await waitFor(() => expect(screen.getByText('My draft')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() =>
      expect(updatePostStatus).toHaveBeenCalledWith('acme', 'd1', 'approved'),
    )
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument())
  })
})
