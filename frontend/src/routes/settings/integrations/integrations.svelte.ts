import { page } from '$app/state'
import type { Integration, ProviderSchema, CreateIntegrationBody } from '$lib/api/integrations'
import type { Tenant } from '$lib/api/tenants'
import {
	createIntegration,
	updateIntegration,
	deleteIntegration,
	testIntegration
} from '$lib/api/integrations'
import * as m from '$lib/paraglide/messages'
import { toast } from 'svelte-sonner'

export class IntegrationManager {
	readonly GROUP_ORDER = ['ads', 'social_media', 'media', 'llm', 'email', 'monitoring']
	readonly GROUP_LABELS: Record<string, string> = {
		ads: m['integrations:roles.ads'](),
		social_media: m['integrations:roles.social_media'](),
		media: m['integrations:roles.media'](),
		llm: m['integrations:roles.llm'](),
		email: m['integrations:roles.email'](),
		monitoring: m['integrations:roles.monitoring']()
	}

	integrations = $state<Integration[]>([])
	providers = $state<ProviderSchema[]>([])
	tenantOptions = $state<{ value: string; label: string }[]>([])
	isLoading = $state(true)

	searchQuery = $state('')
	selectedCategory = $state('all')

	showModal = $state(false)
	editingId = $state<string | null>(null)
	activeProvider = $state<ProviderSchema | null>(null)
	form = $state<Record<string, string>>({})
	formName = $state('')
	formTenants = $state<string[]>([])
	isSubmitting = $state(false)
	isTesting = $state(false)

	showDelete = $state(false)
	deletingId = $state<string | null>(null)
	isDeleting = $state(false)

	constructor() {}

	async init(data: {
		data: Promise<{ integrations: Integration[]; providers: ProviderSchema[] }>
		tenants: Promise<Tenant[]>
	}) {
		const [d, t] = await Promise.all([data.data, data.tenants])
		if (d) {
			this.integrations = [...(d.integrations ?? [])]
			this.providers = d.providers ?? []
		}
		if (t && Array.isArray(t)) {
			this.tenantOptions = t
				.filter((item) => item && item.id)
				.map((item: Tenant) => ({ value: item.id, label: item.name || item.id }))
		}
		this.isLoading = false
	}

	filteredProviders = $derived(
		this.providers.filter((p) => {
			const matchesSearch =
				p.display_name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
				p.provider.toLowerCase().includes(this.searchQuery.toLowerCase())
			const matchesCategory = this.selectedCategory === 'all' || p.group === this.selectedCategory
			return matchesSearch && matchesCategory
		})
	)

	justConnected = $derived(page.url.searchParams.get('connected') === '1')

	connectedMessage = $derived.by(() => {
		const name = page.url.searchParams.get('provider_name')
		return name
			? `${name} connected successfully. The integration is now active.`
			: 'Integration connected successfully. It is now active.'
	})

	clearFilters() {
		this.searchQuery = ''
		this.selectedCategory = 'all'
	}

	private resetModalState() {
		this.form = {}
		this.formName = ''
		this.formTenants = []
	}

	openCreate(provider: ProviderSchema) {
		this.resetModalState()
		this.editingId = null
		this.activeProvider = provider
		for (const f of provider.config_fields ?? []) {
			if (f.type === 'select' && f.options?.length) {
				this.form[f.key] = f.options[0].value
			}
		}
		this.showModal = true
	}

	openEdit(ig: Integration, provider: ProviderSchema) {
		this.resetModalState()
		this.editingId = ig.id
		this.activeProvider = provider
		this.formName = ig.name
		this.formTenants = [...ig.tenant_ids]
		for (const f of [...(provider.config_fields ?? []), ...(provider.credential_fields ?? [])]) {
			this.form[f.key] = ig.config[f.key] ?? ''
		}
		this.showModal = true
	}

	confirmDelete(id: string) {
		this.deletingId = id
		this.showDelete = true
	}

	async handleSave() {
		if (!this.formName.trim() || !this.activeProvider) {
			toast.error('Name is required')
			return
		}
		this.isSubmitting = true
		try {
			const payload = this.buildPayload()!
			if (this.editingId) {
				const updated = await updateIntegration(this.editingId, payload)
				this.integrations = this.integrations.map((i) => (i.id === this.editingId ? updated : i))
				toast.success('Integration updated.')
			} else {
				const created = await createIntegration(payload)
				this.integrations = [...this.integrations, created]
				if (this.activeProvider.oauth_flow && this.activeProvider.oauth_start_path) {
					window.location.href = `${this.activeProvider.oauth_start_path}?integration_id=${created.id}`
					return
				}
				toast.success('Integration added.')
			}
			this.showModal = false
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Save failed')
		} finally {
			this.isSubmitting = false
		}
	}

	async handleTest() {
		if (!this.editingId) return
		this.isTesting = true
		try {
			const result = await testIntegration(this.editingId)
			if (result.ok) {
				toast.success('Connection successful.')
			} else {
				toast.error(result.error ?? 'Connection failed.')
			}
		} catch {
			toast.error('Test request failed.')
		} finally {
			this.isTesting = false
		}
	}

	async handleConnect(id: string) {
		try {
			const result = await testIntegration(id)
			if (result.ok) {
				this.integrations = this.integrations.map((i) =>
					i.id === id ? { ...i, status: 'connected', error_message: null } : i
				)
				toast.success('Connected successfully.')
			} else {
				this.integrations = this.integrations.map((i) =>
					i.id === id
						? { ...i, status: 'error', error_message: result.error ?? 'Connection failed' }
						: i
				)
				toast.error(result.error ?? 'Connection failed.')
			}
		} catch {
			toast.error('Connect request failed.')
		}
	}

	async handleDelete() {
		if (!this.deletingId) return
		this.isDeleting = true
		try {
			await deleteIntegration(this.deletingId)
			this.integrations = this.integrations.filter((i) => i.id !== this.deletingId)
			this.showDelete = false
			this.deletingId = null
			toast.success('Integration deleted.')
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Delete failed')
		} finally {
			this.isDeleting = false
		}
	}

	private buildPayload(): CreateIntegrationBody | null {
		if (!this.activeProvider) return null
		const payload: CreateIntegrationBody & Record<string, string | null | string[]> = {
			name: this.formName.trim(),
			provider: this.activeProvider.provider,
			tenant_ids: this.formTenants
		}

		const allFields = [
			...(this.activeProvider.config_fields ?? []),
			...(this.activeProvider.credential_fields ?? [])
		]

		for (const f of allFields) {
			payload[f.key] = this.form[f.key]?.trim() || null
		}
		return payload
	}

	providerForIntegration(ig: Integration): ProviderSchema | undefined {
		return this.providers.find((p) => p.provider === ig.provider)
	}
}
