import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../../store/auth'

// ── API mock ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/api/legal', () => ({
  getLegalVersions: vi.fn(),
  createLegalVersion: vi.fn(),
  updateLegalVersion: vi.fn(),
}))

// ── Sonner toast mock ─────────────────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ── Router mock ───────────────────────────────────────────────────────────────
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...original,
    createFileRoute: () => (config: { component: React.ComponentType }) => config,
    redirect: original.redirect,
  }
})

// ── i18n mock ─────────────────────────────────────────────────────────────────
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: (ns?: string) => ({
      t: (key: string, params?: Record<string, unknown>) => {
        const base = ns ? `${ns}:${key}` : key
        if (params) {
          return Object.entries(params).reduce(
            (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
            base,
          )
        }
        return base
      },
    }),
  }
})

// ── Imports after mocks ───────────────────────────────────────────────────────
import React from 'react'
import { getLegalVersions, createLegalVersion, updateLegalVersion } from '@/lib/api/legal'
import { toast } from 'sonner'
import { LegalRoute } from './legal'

const mockGetLegalVersions = vi.mocked(getLegalVersions)
const mockCreateLegalVersion = vi.mocked(createLegalVersion)
const mockUpdateLegalVersion = vi.mocked(updateLegalVersion)
const mockToastSuccess = vi.mocked(toast.success)
const mockToastError = vi.mocked(toast.error)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VERSION_1 = {
  id: 'v1',
  version: 1,
  fallback_locale: 'en',
  translations: {
    en: [{ title: 'Section 1', content: 'Body 1' }],
    'pt-BR': [{ title: 'Seção 1', content: 'Corpo 1' }],
  },
  effective_at: '2024-01-01T00:00:00Z',
  created_at: '2024-01-01T00:00:00Z',
}

const VERSION_2 = {
  id: 'v2',
  version: 2,
  fallback_locale: 'pt-BR',
  translations: {
    en: [{ title: 'Section 2', content: 'Body 2' }],
    'pt-BR': [{ title: 'Seção 2', content: 'Corpo 2' }],
  },
  effective_at: '2024-06-01T00:00:00Z',
  created_at: '2024-06-01T00:00:00Z',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderLegal(queryClient = makeQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <LegalRoute />
    </QueryClientProvider>,
  )
}

function setUser() {
  useAuth.setState({
    token: 'tok',
    user: {
      id: 'u1',
      name: 'Admin',
      email: 'admin@test.com',
      tenant_id: '',
      permissions: [],
      locale: 'en',
      system_role: 'platform_admin',
    },
    pendingTerms: null,
  })
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  useAuth.getState().clear()
  vi.clearAllMocks()
  setUser()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests — list rendering ────────────────────────────────────────────────────

describe('LegalRoute — version list', () => {
  it('renders both version rows when query returns 2 versions', async () => {
    mockGetLegalVersions.mockResolvedValue([VERSION_1, VERSION_2])
    renderLegal()

    await waitFor(() => {
      expect(screen.getByTestId('version-row-v1')).toBeInTheDocument()
      expect(screen.getByTestId('version-row-v2')).toBeInTheDocument()
    })
  })

  it('shows version label text for each version', async () => {
    mockGetLegalVersions.mockResolvedValue([VERSION_1, VERSION_2])
    renderLegal()

    await waitFor(() => {
      // i18n mock produces e.g. "settings:legal_version_label1" (interpolated)
      const rows = screen.getAllByTestId(/^version-row-/)
      expect(rows).toHaveLength(2)
    })
  })

  it('shows skeletons while loading', async () => {
    // Never resolves during the test — stays in loading state
    mockGetLegalVersions.mockImplementation(() => new Promise(() => {}))
    renderLegal()

    // The component should show loading skeletons
    await waitFor(() => {
      const page = screen.getByTestId('legal-page')
      expect(page).toBeInTheDocument()
    })
  })

  it('shows empty state text when no versions and not new', async () => {
    mockGetLegalVersions.mockResolvedValue([])
    renderLegal()

    await waitFor(() => {
      // The left sidebar shows the no-versions text
      expect(screen.getAllByText(/settings:legal_no_versions/).length).toBeGreaterThan(0)
    })
  })
})

// ── Tests — new version flow ──────────────────────────────────────────────────

describe('LegalRoute — new version', () => {
  it('clicking new-version btn shows the editor with an empty block per locale', async () => {
    mockGetLegalVersions.mockResolvedValue([])
    renderLegal()

    await waitFor(() => {
      expect(screen.getByTestId('new-version-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('new-version-btn'))

    await waitFor(() => {
      // editor is visible
      expect(screen.getByTestId('save-btn')).toBeInTheDocument()
      // one block is shown for the active locale (en)
      expect(screen.getByTestId('block-0')).toBeInTheDocument()
      // new-version row appears in the sidebar
      expect(screen.getByTestId('new-version-row')).toBeInTheDocument()
    })
  })

  it('shows the locale tab triggers', async () => {
    mockGetLegalVersions.mockResolvedValue([])
    renderLegal()

    await waitFor(() => screen.getByTestId('new-version-btn'))
    fireEvent.click(screen.getByTestId('new-version-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('tab-en')).toBeInTheDocument()
      expect(screen.getByTestId('tab-pt-BR')).toBeInTheDocument()
    })
  })
})

// ── Tests — block editing ─────────────────────────────────────────────────────

describe('LegalRoute — block manipulation', () => {
  async function openNewEditor() {
    mockGetLegalVersions.mockResolvedValue([])
    renderLegal()
    await waitFor(() => screen.getByTestId('new-version-btn'))
    fireEvent.click(screen.getByTestId('new-version-btn'))
    await waitFor(() => screen.getByTestId('block-0'))
  }

  it('add-block button adds a second block', async () => {
    await openNewEditor()

    fireEvent.click(screen.getByTestId('add-block-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('block-1')).toBeInTheDocument()
    })
  })

  it('remove-block button removes a block', async () => {
    await openNewEditor()

    // Add a second block first so we can still have one left
    fireEvent.click(screen.getByTestId('add-block-btn'))
    await waitFor(() => screen.getByTestId('block-1'))

    fireEvent.click(screen.getByTestId('remove-block-0'))

    await waitFor(() => {
      expect(screen.queryByTestId('block-1')).not.toBeInTheDocument()
    })
  })

  it('editing block title input updates state', async () => {
    await openNewEditor()

    const titleInput = screen.getByTestId('block-title-0') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: 'My Title' } })

    await waitFor(() => {
      expect((screen.getByTestId('block-title-0') as HTMLInputElement).value).toBe('My Title')
    })
  })

  it('editing block content textarea updates state', async () => {
    await openNewEditor()

    const textarea = screen.getByTestId('block-content-0') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'My Content' } })

    await waitFor(() => {
      expect((screen.getByTestId('block-content-0') as HTMLTextAreaElement).value).toBe(
        'My Content',
      )
    })
  })
})

// ── Tests — save new version ──────────────────────────────────────────────────

describe('LegalRoute — save (create)', () => {
  it('calls createLegalVersion with the right body shape on Save', async () => {
    const created = { ...VERSION_1, id: 'v-new', version: 3 }
    mockGetLegalVersions.mockResolvedValue([])
    mockCreateLegalVersion.mockResolvedValue(created)

    renderLegal()
    await waitFor(() => screen.getByTestId('new-version-btn'))
    fireEvent.click(screen.getByTestId('new-version-btn'))
    await waitFor(() => screen.getByTestId('save-btn'))

    fireEvent.click(screen.getByTestId('save-btn'))

    await waitFor(() => {
      expect(mockCreateLegalVersion).toHaveBeenCalledOnce()
      const [body] = mockCreateLegalVersion.mock.calls[0]
      expect(body).toHaveProperty('fallback_locale')
      expect(body).toHaveProperty('translations')
      expect(body).toHaveProperty('effective_at')
      expect(typeof body.effective_at).toBe('string')
      // translations has both locales
      expect(body.translations).toHaveProperty('en')
      expect(body.translations).toHaveProperty('pt-BR')
    })
  })

  it('shows success toast after successful create', async () => {
    const created = { ...VERSION_1, id: 'v-new', version: 3 }
    mockGetLegalVersions.mockResolvedValue([])
    mockCreateLegalVersion.mockResolvedValue(created)

    renderLegal()
    await waitFor(() => screen.getByTestId('new-version-btn'))
    fireEvent.click(screen.getByTestId('new-version-btn'))
    await waitFor(() => screen.getByTestId('save-btn'))
    fireEvent.click(screen.getByTestId('save-btn'))

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('settings:legal_toast_created')
    })
  })

  it('shows error toast when createLegalVersion throws', async () => {
    mockGetLegalVersions.mockResolvedValue([])
    mockCreateLegalVersion.mockRejectedValue(new Error('network error'))

    renderLegal()
    await waitFor(() => screen.getByTestId('new-version-btn'))
    fireEvent.click(screen.getByTestId('new-version-btn'))
    await waitFor(() => screen.getByTestId('save-btn'))
    fireEvent.click(screen.getByTestId('save-btn'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('globals:error_generic')
    })
  })
})

// ── Tests — save existing version ─────────────────────────────────────────────

describe('LegalRoute — save (update)', () => {
  it('calls updateLegalVersion(id, body) when editing an existing version', async () => {
    mockGetLegalVersions.mockResolvedValue([VERSION_1, VERSION_2])
    mockUpdateLegalVersion.mockResolvedValue(undefined)

    renderLegal()

    // Wait for list to render then select version 1
    await waitFor(() => screen.getByTestId('version-row-v1'))
    fireEvent.click(screen.getByTestId('version-row-v1'))

    await waitFor(() => screen.getByTestId('save-btn'))
    fireEvent.click(screen.getByTestId('save-btn'))

    await waitFor(() => {
      expect(mockUpdateLegalVersion).toHaveBeenCalledOnce()
      const [id, body] = mockUpdateLegalVersion.mock.calls[0]
      expect(id).toBe('v1')
      expect(body).toHaveProperty('fallback_locale')
      expect(body).toHaveProperty('translations')
      expect(body).toHaveProperty('effective_at')
    })
  })

  it('shows success toast after successful update', async () => {
    mockGetLegalVersions.mockResolvedValue([VERSION_1])
    mockUpdateLegalVersion.mockResolvedValue(undefined)

    renderLegal()
    await waitFor(() => screen.getByTestId('version-row-v1'))
    fireEvent.click(screen.getByTestId('version-row-v1'))
    await waitFor(() => screen.getByTestId('save-btn'))
    fireEvent.click(screen.getByTestId('save-btn'))

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('settings:legal_toast_saved')
    })
  })
})
