import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  type Integration,
  type ProviderSchema,
  type CreateIntegrationBody,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegration,
} from '@/lib/api/integrations'
import { type Tenant } from '@/lib/api/tenants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntegrationManagerState {
  // constants
  GROUP_ORDER: string[]
  GROUP_LABELS: Record<string, string>

  // read state
  integrations: Integration[]
  providers: ProviderSchema[]
  tenantOptions: { value: string; label: string }[]
  isLoading: boolean
  searchQuery: string
  selectedCategory: string
  showModal: boolean
  editingId: string | null
  activeProvider: ProviderSchema | null
  form: Record<string, string>
  formName: string
  formTenants: string[]
  isSubmitting: boolean
  isTesting: boolean
  showDelete: boolean
  deletingId: string | null
  isDeleting: boolean

  // derived
  filteredProviders: ProviderSchema[]
  justConnected: boolean
  connectedMessage: string

  // setters
  setSearchQuery: (v: string) => void
  setSelectedCategory: (v: string) => void
  setShowModal: (v: boolean) => void
  setShowDelete: (v: boolean) => void
  setFormName: (v: string) => void
  setFormTenants: (v: string[]) => void
  setFormField: (key: string, value: string) => void

  // actions
  init: (data: {
    data: Promise<{ integrations: Integration[]; providers: ProviderSchema[] }>
    tenants: Promise<Tenant[]>
  }) => Promise<void>
  clearFilters: () => void
  openCreate: (provider: ProviderSchema) => void
  openEdit: (ig: Integration, provider: ProviderSchema) => void
  confirmDelete: (id: string) => void
  handleSave: () => Promise<void>
  handleTest: () => Promise<void>
  handleConnect: (id: string) => Promise<void>
  handleDelete: () => Promise<void>
  providerForIntegration: (ig: Integration) => ProviderSchema | undefined
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIntegrationManager(): IntegrationManagerState {
  const { t } = useTranslation('integrations')

  // Tanstack Router search params (strict:false — works on any route)
  const search = useSearch({ strict: false }) as Record<string, unknown>

  // ------- constants -------------------------------------------------------

  const GROUP_ORDER = [
    'ads',
    'social_media',
    'media',
    'llm',
    'email',
    'monitoring',
  ]

  const GROUP_LABELS = useMemo<Record<string, string>>(
    () => ({
      ads: t('roles.ads'),
      social_media: t('roles.social_media'),
      media: t('roles.media'),
      llm: t('roles.llm'),
      email: t('roles.email'),
      monitoring: t('roles.monitoring'),
    }),
    [t],
  )

  // ------- state -----------------------------------------------------------

  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [providers, setProviders] = useState<ProviderSchema[]>([])
  const [tenantOptions, setTenantOptions] = useState<
    { value: string; label: string }[]
  >([])
  const [isLoading, setIsLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeProvider, setActiveProvider] = useState<ProviderSchema | null>(
    null,
  )
  const [form, setForm] = useState<Record<string, string>>({})
  const [formName, setFormName] = useState('')
  const [formTenants, setFormTenants] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const [showDelete, setShowDelete] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ------- derived ---------------------------------------------------------

  const filteredProviders = useMemo(
    () =>
      providers.filter((p) => {
        const matchesSearch =
          p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.provider.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory =
          selectedCategory === 'all' || p.group === selectedCategory
        return matchesSearch && matchesCategory
      }),
    [providers, searchQuery, selectedCategory],
  )

  const justConnected = useMemo(
    () => String(search.connected) === '1',
    [search.connected],
  )

  const connectedMessage = useMemo(() => {
    const name = search.provider_name
    return name
      ? `${name} connected successfully. The integration is now active.`
      : 'Integration connected successfully. It is now active.'
  }, [search.provider_name])

  // ------- helpers ---------------------------------------------------------

  const resetModalState = useCallback(() => {
    setForm({})
    setFormName('')
    setFormTenants([])
  }, [])

  // ------- actions ---------------------------------------------------------

  const init = useCallback(
    async (data: {
      data: Promise<{ integrations: Integration[]; providers: ProviderSchema[] }>
      tenants: Promise<Tenant[]>
    }) => {
      const [d, tenantList] = await Promise.all([data.data, data.tenants])
      if (d) {
        setIntegrations([...(d.integrations ?? [])])
        setProviders(d.providers ?? [])
      }
      if (tenantList && Array.isArray(tenantList)) {
        setTenantOptions(
          tenantList
            .filter((item) => item && item.id)
            .map((item) => ({ value: item.id, label: item.name || item.id })),
        )
      }
      setIsLoading(false)
    },
    [],
  )

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setSelectedCategory('all')
  }, [])

  const openCreate = useCallback(
    (provider: ProviderSchema) => {
      resetModalState()
      setEditingId(null)
      setActiveProvider(provider)
      const next: Record<string, string> = {}
      for (const f of provider.config_fields ?? []) {
        if (f.type === 'select' && f.options?.length) {
          next[f.key] = f.options[0].value
        }
      }
      setForm(next)
      setShowModal(true)
    },
    [resetModalState],
  )

  const openEdit = useCallback(
    (ig: Integration, provider: ProviderSchema) => {
      resetModalState()
      setEditingId(ig.id)
      setActiveProvider(provider)
      setFormName(ig.name)
      setFormTenants([...ig.tenant_ids])
      const next: Record<string, string> = {}
      for (const f of [
        ...(provider.config_fields ?? []),
        ...(provider.credential_fields ?? []),
      ]) {
        next[f.key] = ig.config[f.key] ?? ''
      }
      setForm(next)
      setShowModal(true)
    },
    [resetModalState],
  )

  const confirmDelete = useCallback((id: string) => {
    setDeletingId(id)
    setShowDelete(true)
  }, [])

  const setFormField = useCallback((key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!formName.trim() || !activeProvider) {
      toast.error(t('toast_name_required'))
      return
    }
    setIsSubmitting(true)
    try {
      // build payload — use a cast because config/credential field keys are
      // dynamic and not statically known in CreateIntegrationBody
      const payload: CreateIntegrationBody & Record<string, unknown> = {
        name: formName.trim(),
        provider: activeProvider.provider,
        tenant_ids: formTenants,
      }
      const allFields = [
        ...(activeProvider.config_fields ?? []),
        ...(activeProvider.credential_fields ?? []),
      ]
      for (const f of allFields) {
        payload[f.key] = form[f.key]?.trim() || null
      }

      if (editingId) {
        const updated = await updateIntegration(
          editingId,
          payload as Partial<CreateIntegrationBody>,
        )
        setIntegrations((prev) =>
          prev.map((i) => (i.id === editingId ? updated : i)),
        )
        toast.success(t('toast_updated'))
      } else {
        const created = await createIntegration(
          payload as CreateIntegrationBody,
        )
        setIntegrations((prev) => [...prev, created])
        if (activeProvider.oauth_flow && activeProvider.oauth_start_path) {
          window.location.href = `${activeProvider.oauth_start_path}?integration_id=${created.id}`
          return
        }
        toast.success(t('toast_added'))
      }
      setShowModal(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    formName,
    activeProvider,
    formTenants,
    form,
    editingId,
    t,
  ])

  const handleTest = useCallback(async () => {
    if (!editingId) return
    setIsTesting(true)
    try {
      const result = await testIntegration(editingId)
      if (result.ok) {
        toast.success('Connection successful.')
      } else {
        toast.error(result.error ?? 'Connection failed.')
      }
    } catch {
      toast.error('Test request failed.')
    } finally {
      setIsTesting(false)
    }
  }, [editingId])

  const handleConnect = useCallback(async (id: string) => {
    try {
      const result = await testIntegration(id)
      if (result.ok) {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === id
              ? { ...i, status: 'connected' as const, error_message: null }
              : i,
          ),
        )
        toast.success('Connected successfully.')
      } else {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: 'error' as const,
                  error_message: result.error ?? 'Connection failed',
                }
              : i,
          ),
        )
        toast.error(result.error ?? 'Connection failed.')
      }
    } catch {
      toast.error('Connect request failed.')
    }
  }, [])

  const handleDelete = useCallback(async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      await deleteIntegration(deletingId)
      setIntegrations((prev) => prev.filter((i) => i.id !== deletingId))
      setShowDelete(false)
      setDeletingId(null)
      toast.success(t('toast_deleted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsDeleting(false)
    }
  }, [deletingId, t])

  const providerForIntegration = useCallback(
    (ig: Integration) => providers.find((p) => p.provider === ig.provider),
    [providers],
  )

  // ------- return surface --------------------------------------------------

  return {
    // constants
    GROUP_ORDER,
    GROUP_LABELS,

    // state
    integrations,
    providers,
    tenantOptions,
    isLoading,
    searchQuery,
    selectedCategory,
    showModal,
    editingId,
    activeProvider,
    form,
    formName,
    formTenants,
    isSubmitting,
    isTesting,
    showDelete,
    deletingId,
    isDeleting,

    // derived
    filteredProviders,
    justConnected,
    connectedMessage,

    // setters
    setSearchQuery,
    setSelectedCategory,
    setShowModal,
    setShowDelete,
    setFormName,
    setFormTenants,
    setFormField,

    // actions
    init,
    clearFilters,
    openCreate,
    openEdit,
    confirmDelete,
    handleSave,
    handleTest,
    handleConnect,
    handleDelete,
    providerForIntegration,
  }
}
