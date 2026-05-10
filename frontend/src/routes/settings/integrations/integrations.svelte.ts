import { page } from '$app/state'
import type { Integration, ProviderSchema, FieldSchema, CreateIntegrationBody } from '$lib/api/integrations'
import type { Tenant } from '$lib/api/tenants'
import {
	createIntegration,
	updateIntegration,
	deleteIntegration,
	testIntegration
} from '$lib/api/integrations'

export class IntegrationManager {
	readonly GROUP_ORDER = ['ads', 'social_media', 'media', 'llm', 'email', 'monitoring']
	readonly GROUP_LABELS: Record<string, string> = {
		ads: 'Advertising',
		social_media: 'Social Media',
		media: 'Media & Storage',
		llm: 'AI Providers',
		email: 'Email',
		monitoring: 'Monitoring'
	}

	// State
	integrations = $state<Integration[]>([])
	providers = $state<ProviderSchema[]>([])
	tenantOptions = $state<{ value: string; label: string }[]>([])
	isLoading = $state(true)
	
	// Filters
	searchQuery = $state('')
	selectedCategory = $state('all')

	// Modal State
	showModal = $state(false)
	editingId = $state<string | null>(null)
	activeProvider = $state<ProviderSchema | null>(null)
	form = $state<Record<string, string>>({})
	formName = $state('')
	formTenants = $state<string[]>([])
	showSecrets = $state<Record<string, boolean>>({})
	isSubmitting = $state(false)
	modalError = $state<string | null>(null)
	testStatus = $state<{ ok: boolean; message: string } | null>(null)
	isTesting = $state(false)

	// Delete State
	showDelete = $state(false)
	deletingId = $state<string | null>(null)
	isDeleting = $state(false)

	constructor() {}

	async init(data: { 
        data: Promise<{ integrations: Integration[], providers: ProviderSchema[] }>; 
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

	// Computed
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

	// Actions
	clearFilters() {
		this.searchQuery = ''
		this.selectedCategory = 'all'
	}

	openCreate(provider: ProviderSchema) {
		this.editingId = null
		this.activeProvider = provider
		this.formName = ''
		this.form = {}
		this.formTenants = []
		this.showSecrets = {}
		this.modalError = null
		this.testStatus = null
		this.showModal = true
	}

	openEdit(ig: Integration, provider: ProviderSchema) {
		this.editingId = ig.id
		this.activeProvider = provider
		this.formName = ig.name
		this.formTenants = [...ig.tenant_ids]
		this.showSecrets = {}
		this.modalError = null
		this.testStatus = null
		this.form = {}
		for (const f of [...provider.config_fields, ...provider.credential_fields]) {
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
			this.modalError = 'Name is required'
			return
		}
		this.isSubmitting = true
		this.modalError = null
		try {
			const payload = this.buildPayload()!
			if (this.editingId) {
				const updated = await updateIntegration(this.editingId, payload)
				this.integrations = this.integrations.map((i) => (i.id === this.editingId ? updated : i))
			} else {
				const created = await createIntegration(payload)
				this.integrations = [...this.integrations, created]
				if (this.activeProvider.oauth_flow && this.activeProvider.oauth_start_path) {
					window.location.href = `${this.activeProvider.oauth_start_path}?integration_id=${created.id}`
					return
				}
			}
			this.showModal = false
		} catch (err) {
			this.modalError = err instanceof Error ? err.message : 'Save failed'
		} finally {
			this.isSubmitting = false
		}
	}

	async handleTest() {
		if (!this.editingId) return
		this.isTesting = true
		this.testStatus = null
		try {
			const result = await testIntegration(this.editingId)
			this.testStatus = result.ok
				? { ok: true, message: 'Connection successful.' }
				: { ok: false, message: result.error ?? 'Connection failed.' }
		} catch {
			this.testStatus = { ok: false, message: 'Test request failed.' }
		} finally {
			this.isTesting = false
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
		} catch {
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
		
		const allFields = [...(this.activeProvider.config_fields ?? []), ...(this.activeProvider.credential_fields ?? [])]

		for (const f of allFields) {
			const v = this.form[f.key]?.trim() ?? ''
			const mapped = this.fieldMap[f.key] ?? f.key
			payload[mapped] = v || null
		}
		return payload
	}

	private fieldMap: Record<string, string> = {
		oauth_client_id: 'oauth_client_id',
		oauth_client_secret: 'oauth_client_secret',
		developer_token: 'developer_token',
		login_customer_id: 'login_customer_id'
	}

	providerForIntegration(ig: Integration): ProviderSchema | undefined {
		return this.providers.find((p) => p.provider === ig.provider)
	}
}
