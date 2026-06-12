import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAuth } from '../../store/auth'
import { NewTenantRoute } from './-new'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...original,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/lib/api/tenants', () => ({
  createTenant: vi.fn(),
}))

import { createTenant } from '@/lib/api/tenants'

const mockTenant = {
  id: 'acme-corp',
  name: 'Acme Corp',
  language: 'pt_BR',
  niche: null,
  location: null,
  primary_persona: null,
  tone: null,
  instructions: null,
  hashtags: [],
  ads_monitoring: null,
  report_prompts: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  useAuth.getState().setToken('test-token')
  vi.mocked(createTenant).mockResolvedValue(mockTenant)
  vi.spyOn(useAuth.getState(), 'restoreSession').mockResolvedValue(true)
  mockNavigate.mockReset()
})

afterEach(() => {
  useAuth.getState().clear()
  vi.restoreAllMocks()
})

describe('NewTenantRoute', () => {
  it('renders the create-tenant form with name and id fields', () => {
    render(<NewTenantRoute />)
    expect(screen.getByLabelText(/client name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/identifier/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create client/i })).toBeInTheDocument()
  })

  it('auto-slugifies the id field from the name input', async () => {
    const user = userEvent.setup()
    render(<NewTenantRoute />)

    const nameInput = screen.getByLabelText(/client name/i)
    await user.type(nameInput, 'Acme Corp')

    const idInput = screen.getByLabelText(/identifier/i) as HTMLInputElement
    expect(idInput.value).toBe('acme-corp')
  })

  it('does not overwrite a manually-edited id when name changes', async () => {
    const user = userEvent.setup()
    render(<NewTenantRoute />)

    const nameInput = screen.getByLabelText(/client name/i)
    const idInput = screen.getByLabelText(/identifier/i) as HTMLInputElement

    await user.type(nameInput, 'Acme Corp')
    expect(idInput.value).toBe('acme-corp')

    // User manually edits the id
    await user.clear(idInput)
    await user.type(idInput, 'custom-id')

    // Typing more into name should NOT overwrite custom-id
    await user.type(nameInput, ' Extra')
    expect(idInput.value).toBe('custom-id')
  })

  it('calls createTenant with the correct payload on submit', async () => {
    const user = userEvent.setup()
    render(<NewTenantRoute />)

    await user.type(screen.getByLabelText(/client name/i), 'Acme Corp')
    await user.click(screen.getByRole('button', { name: /create client/i }))

    await waitFor(() => {
      expect(createTenant).toHaveBeenCalledWith({
        id: 'acme-corp',
        name: 'Acme Corp',
        language: 'pt_BR',
      })
    })
  })

  it('navigates to / after successful creation', async () => {
    const user = userEvent.setup()
    render(<NewTenantRoute />)

    await user.type(screen.getByLabelText(/client name/i), 'Acme')
    await user.click(screen.getByRole('button', { name: /create client/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
    })
  })

  it('shows an error alert when createTenant throws', async () => {
    vi.mocked(createTenant).mockRejectedValue(new Error('Name already taken'))

    const user = userEvent.setup()
    render(<NewTenantRoute />)

    await user.type(screen.getByLabelText(/client name/i), 'Acme')
    await user.click(screen.getByRole('button', { name: /create client/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Name already taken')
    })
  })

  it('disables the submit button while loading', async () => {
    let resolveCreate!: (v: unknown) => void
    const pending = new Promise((res) => {
      resolveCreate = res
    })
    vi.mocked(createTenant).mockReturnValue(pending as ReturnType<typeof createTenant>)

    const user = userEvent.setup()
    render(<NewTenantRoute />)

    await user.type(screen.getByLabelText(/client name/i), 'Acme')
    await user.click(screen.getByRole('button', { name: /create client/i }))

    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled()

    resolveCreate(undefined)
  })
})
