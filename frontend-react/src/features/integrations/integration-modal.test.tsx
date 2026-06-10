import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import '@/lib/i18n/index'

import { IntegrationModal } from './integration-modal'
import type { useIntegrationManager } from './use-integration-manager'

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeManager(
  overrides: Partial<ReturnType<typeof useIntegrationManager>> = {},
): ReturnType<typeof useIntegrationManager> {
  const base: ReturnType<typeof useIntegrationManager> = {
    // constants
    GROUP_ORDER: [],
    GROUP_LABELS: {},

    // state
    integrations: [],
    providers: [],
    tenantOptions: [],
    isLoading: false,
    searchQuery: '',
    selectedCategory: 'all',
    showModal: true,
    editingId: null,
    activeProvider: {
      provider: 'stripe',
      group: 'ads',
      display_name: 'Stripe',
      description: 'desc',
      logo_svg: '',
      logo_png: '',
      config_fields: [
        { key: 'host', type: 'text', label: 'Host', required: false },
        {
          key: 'mode',
          type: 'select',
          label: 'Mode',
          required: false,
          options: [
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta' },
          ],
        },
      ],
      credential_fields: [],
      oauth_flow: false,
    },
    form: {},
    formName: '',
    formTenants: [],
    isSubmitting: false,
    isTesting: false,
    showDelete: false,
    deletingId: null,
    isDeleting: false,

    // derived
    filteredProviders: [],
    justConnected: false,
    connectedMessage: '',

    // setters
    setSearchQuery: vi.fn(),
    setSelectedCategory: vi.fn(),
    setShowModal: vi.fn(),
    setShowDelete: vi.fn(),
    setFormName: vi.fn(),
    setFormTenants: vi.fn(),
    setFormField: vi.fn(),

    // actions
    init: vi.fn(),
    clearFilters: vi.fn(),
    openCreate: vi.fn(),
    openEdit: vi.fn(),
    confirmDelete: vi.fn(),
    handleSave: vi.fn(),
    handleTest: vi.fn(),
    handleConnect: vi.fn(),
    handleDelete: vi.fn(),
    providerForIntegration: vi.fn(),

    ...overrides,
  }
  return base
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IntegrationModal', () => {
  it('renders the title "Add Stripe" when editingId is null', () => {
    render(
      <IntegrationModal
        manager={makeManager()}
        onSave={vi.fn()}
        onTest={vi.fn()}
      />,
    )
    expect(screen.getByText('Add Stripe')).toBeInTheDocument()
  })

  it('renders field label "Host" from config_fields', () => {
    render(
      <IntegrationModal
        manager={makeManager()}
        onSave={vi.fn()}
        onTest={vi.fn()}
      />,
    )
    expect(screen.getByText('Host')).toBeInTheDocument()
  })

  it('renders field label "Mode" from config_fields', () => {
    render(
      <IntegrationModal
        manager={makeManager()}
        onSave={vi.fn()}
        onTest={vi.fn()}
      />,
    )
    expect(screen.getByText('Mode')).toBeInTheDocument()
  })

  it('calls onSave when the form is submitted', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    // formName is pre-filled so the required input is not empty
    render(
      <IntegrationModal
        manager={makeManager({ formName: 'My Integration' })}
        onSave={onSave}
        onTest={vi.fn()}
      />,
    )

    const submitBtn = screen.getByRole('button', { name: /save/i })
    await user.click(submitBtn)

    expect(onSave).toHaveBeenCalledOnce()
  })

  it('renders "Edit Stripe" when editingId is set', () => {
    render(
      <IntegrationModal
        manager={makeManager({ editingId: 'abc-123' })}
        onSave={vi.fn()}
        onTest={vi.fn()}
      />,
    )
    expect(screen.getByText('Edit Stripe')).toBeInTheDocument()
  })

  it('does not render when showModal is false', () => {
    render(
      <IntegrationModal
        manager={makeManager({ showModal: false })}
        onSave={vi.fn()}
        onTest={vi.fn()}
      />,
    )
    expect(screen.queryByText('Add Stripe')).not.toBeInTheDocument()
  })
})
