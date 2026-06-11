import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...original,
    createFileRoute: (_path: string) => (opts: { beforeLoad?: () => void; component: unknown }) => ({
      ...opts,
      useParams: () => ({ tenant: 'acme', post_id: 'p1' }),
    }),
    redirect: original.redirect,
    useNavigate: () => navigateMock,
    Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
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
  getPost: vi.fn(),
  getPublishResults: vi.fn(),
  updatePost: vi.fn(),
  updatePostStatus: vi.fn(),
  deletePost: vi.fn(),
}))
vi.mock('@/lib/api/tenants', () => ({ getTenant: vi.fn() }))
vi.mock('@/lib/api/ai', () => ({ streamGenerate: vi.fn() }))
vi.mock('@/lib/api/media', () => ({ uploadMedia: vi.fn() }))

import { getPost, getPublishResults, updatePost, updatePostStatus } from '@/lib/api/posts'
import { getTenant } from '@/lib/api/tenants'
import type { Post } from '@/lib/api/posts'
import { PostEditorRoute } from './$post_id'

const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: 'p1',
  tenant_id: 'acme',
  status: 'draft',
  title: 'Editable title',
  content: 'Editable content',
  hashtags: ['x', 'y'],
  media_type: 'image',
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

describe('PostEditorRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getPost).mockResolvedValue(makePost())
    vi.mocked(getPublishResults).mockResolvedValue([])
    vi.mocked(getTenant).mockResolvedValue({ id: 'acme', name: 'Acme' } as never)
    vi.mocked(updatePost).mockResolvedValue({} as never)
    vi.mocked(updatePostStatus).mockResolvedValue({} as never)
  })

  it('loads the post and seeds the editor fields', async () => {
    render(<PostEditorRoute />)
    await waitFor(() => expect(getPost).toHaveBeenCalledWith('acme', 'p1'))
    await waitFor(() =>
      expect(screen.getByLabelText('post_title_label')).toHaveValue('Editable title'),
    )
    expect(screen.getByLabelText('post_content_label')).toHaveValue('Editable content')
    expect(screen.getByLabelText(/Hashtags/)).toHaveValue('x y')
  })

  it('saves edits via updatePost and navigates back to the planner', async () => {
    const user = userEvent.setup()
    render(<PostEditorRoute />)
    await waitFor(() => expect(screen.getByLabelText('post_title_label')).toHaveValue('Editable title'))

    const title = screen.getByLabelText('post_title_label')
    await user.clear(title)
    await user.type(title, 'Updated title')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1))
    expect(updatePost).toHaveBeenCalledWith(
      'acme',
      'p1',
      expect.objectContaining({ title: 'Updated title', hashtags: ['x', 'y'], media_type: 'image' }),
    )
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({ to: '/$tenant/social', params: { tenant: 'acme' } }),
    )
  })

  it('calls updatePostStatus only when the status changed', async () => {
    const user = userEvent.setup()
    render(<PostEditorRoute />)
    await waitFor(() => expect(screen.getByLabelText('post_title_label')).toHaveValue('Editable title'))

    // change status draft → approved (two comboboxes: Status then Media)
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[0], 'approved')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(updatePostStatus).toHaveBeenCalledWith('acme', 'p1', 'approved'))
  })
})
