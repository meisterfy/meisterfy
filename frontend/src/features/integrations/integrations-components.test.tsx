import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import '@/lib/i18n/index'

import { CardAdd } from './card-add'
import { IntegrationFilters } from './integration-filters'
import { CardConnected } from './card-connected'
import type { ProviderSchema, Integration } from '@/lib/api/integrations'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeProvider = (overrides: Partial<ProviderSchema> = {}): ProviderSchema => ({
  provider: 'test_provider',
  group: 'ads',
  display_name: 'Test Provider',
  description: 'A test provider',
  logo_svg: '',
  logo_png: '',
  config_fields: [],
  credential_fields: [],
  oauth_flow: false,
  oauth_start_path: undefined,
  ...overrides,
})

const makeIntegration = (overrides: Partial<Integration> = {}): Integration => ({
  id: 'integ-1',
  name: 'My Integration',
  provider: 'test_provider',
  group: 'ads',
  status: 'connected',
  error_message: null,
  tenant_ids: [],
  config: {},
  has_credentials: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

// ---------------------------------------------------------------------------
// CardAdd
// ---------------------------------------------------------------------------

describe('CardAdd', () => {
  it('renders the provider display_name', () => {
    render(<CardAdd provider={makeProvider()} onClick={vi.fn()} />)
    expect(screen.getByText('Test Provider')).toBeInTheDocument()
  })

  it('renders the provider description', () => {
    render(<CardAdd provider={makeProvider()} onClick={vi.fn()} />)
    expect(screen.getByText('A test provider')).toBeInTheDocument()
  })

  it('fires onClick when the add connection button is clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<CardAdd provider={makeProvider()} onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: /add connection/i }))

    expect(onClick).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// IntegrationFilters
// ---------------------------------------------------------------------------

describe('IntegrationFilters', () => {
  const defaultProps = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    selectedCategory: 'all',
    onCategoryChange: vi.fn(),
    categories: ['ads', 'social_media'],
    categoryLabels: { ads: 'Advertising', social_media: 'Social Media' },
    onClear: vi.fn(),
  }

  it('renders the search input', () => {
    render(<IntegrationFilters {...defaultProps} />)
    expect(
      screen.getByPlaceholderText(/search connections/i),
    ).toBeInTheDocument()
  })

  it('does NOT show the clear button when filters are empty', () => {
    render(<IntegrationFilters {...defaultProps} />)
    expect(screen.queryByText(/clear filters/i)).not.toBeInTheDocument()
  })

  it('shows the clear button when searchQuery is set', () => {
    render(<IntegrationFilters {...defaultProps} searchQuery="x" />)
    expect(screen.getByText(/clear filters/i)).toBeInTheDocument()
  })

  it('fires onClear when the clear button is clicked', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(<IntegrationFilters {...defaultProps} searchQuery="x" onClear={onClear} />)

    await user.click(screen.getByText(/clear filters/i))

    expect(onClear).toHaveBeenCalledOnce()
  })

  it('fires onSearchChange as the user types', async () => {
    const user = userEvent.setup()
    const onSearchChange = vi.fn()
    render(
      <IntegrationFilters {...defaultProps} onSearchChange={onSearchChange} />,
    )

    await user.type(screen.getByPlaceholderText(/search connections/i), 'go')

    expect(onSearchChange).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// CardConnected — smoke test
// ---------------------------------------------------------------------------

describe('CardConnected', () => {
  it('renders integration.name', () => {
    render(
      <CardConnected
        integration={makeIntegration()}
        provider={makeProvider()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('My Integration')).toBeInTheDocument()
  })

  it('fires onEdit when the Edit button is clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(
      <CardConnected
        integration={makeIntegration()}
        provider={makeProvider()}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    )

    await user.click(screen.getByTitle('Edit'))

    expect(onEdit).toHaveBeenCalledOnce()
  })

  it('fires onDelete when the Delete button is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <CardConnected
        integration={makeIntegration()}
        provider={makeProvider()}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    )

    await user.click(screen.getByTitle('Delete'))

    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('shows error_message when status is error', () => {
    render(
      <CardConnected
        integration={makeIntegration({
          status: 'error',
          error_message: 'Auth failed',
        })}
        provider={makeProvider()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Auth failed')).toBeInTheDocument()
  })

  it('renders tenant labels when tenant_ids are set', () => {
    render(
      <CardConnected
        integration={makeIntegration({ tenant_ids: ['t-1'] })}
        provider={makeProvider()}
        tenantOptions={[{ value: 't-1', label: 'Acme Corp' }]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })
})
