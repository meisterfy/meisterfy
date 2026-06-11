import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Router mock — stub Route.useParams ────────────────────────────────────────
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

// ── i18n mock ─────────────────────────────────────────────────────────────────
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (_ns?: string) => ({ t: (key: string) => key }),
  }
})

// ── API mocks ─────────────────────────────────────────────────────────────────
vi.mock('@/lib/api/posts', () => ({
  getPosts: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
}))
vi.mock('@/lib/api/media', () => ({
  uploadMedia: vi.fn(),
  deleteMedia: vi.fn(),
}))
vi.mock('@/lib/api/social-accounts', () => ({ getConnectedMetaPages: vi.fn() }))

import { getPosts } from '@/lib/api/posts'
import { getConnectedMetaPages } from '@/lib/api/social-accounts'
import type { Post } from '@/lib/api/posts'
import { SocialPlannerRoute } from './-index'

// today (currentDate fixture) is 2026-06, so schedule a post in the default view month
const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: 'post-1',
  tenant_id: 'acme',
  status: 'scheduled',
  title: 'Summer launch',
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
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  ...overrides,
})

describe('SocialPlannerRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getConnectedMetaPages).mockResolvedValue([])
  })

  it('loads scheduled posts for the tenant and renders them on the calendar', async () => {
    vi.mocked(getPosts).mockResolvedValue([makePost()])
    render(<SocialPlannerRoute />)

    await waitFor(() => expect(getPosts).toHaveBeenCalledWith('acme', 'scheduled'))
    await waitFor(() => expect(screen.getByText('Summer launch')).toBeInTheDocument())
  })

  it('renders the calendar grid even when there are no posts', async () => {
    vi.mocked(getPosts).mockResolvedValue([])
    render(<SocialPlannerRoute />)

    await waitFor(() => expect(getPosts).toHaveBeenCalledWith('acme', 'scheduled'))
    // Day-of-week headers come from the calendar widget
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('falls back to an empty calendar when the load fails', async () => {
    vi.mocked(getPosts).mockRejectedValue(new Error('boom'))
    render(<SocialPlannerRoute />)

    await waitFor(() => expect(getPosts).toHaveBeenCalledWith('acme', 'scheduled'))
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })
})
