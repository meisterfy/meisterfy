<script lang="ts">
	import { untrack } from 'svelte'
	import { page } from '$app/state'
	import { Dialog } from 'bits-ui'
	import {
		CheckCircle2,
		XCircle,
		AlertCircle,
		Link2,
		Pencil,
		Trash2,
		Plus,
		Eye,
		EyeOff,
		FlaskConical
	} from 'lucide-svelte'
	import Skeleton from '$lib/components/ui/skeleton.svelte'
	import ProviderIcon from '$lib/components/ui/ProviderIcon.svelte'
	import ConfirmDialog from '$lib/components/ui/dialog/ConfirmDialog.svelte'
	import MultiSelect from '$lib/components/ui/multiselect/MultiSelect.svelte'
	import type { PageData } from './$types'
	import type { Integration, ProviderSchema, FieldSchema } from '$lib/api/integrations'
	import {
		createIntegration,
		updateIntegration,
		deleteIntegration,
		testIntegration
	} from '$lib/api/integrations'

	let { data } = $props<{ data: PageData }>()

	let integrations = $state<Integration[]>([])
	let providers = $state<ProviderSchema[]>([])
	let tenantOptions = $state<{ value: string; label: string }[]>([])
	let isLoading = $state(true)

	$effect(() => {
		Promise.all([data.data, data.tenants]).then(([d, t]) => {
			if (d) {
				integrations = [...(d.integrations ?? [])]
				providers = d.providers ?? []
			}
			if (t && Array.isArray(t)) {
				tenantOptions = t
					.filter((item) => item && item.id)
					.map((item: any) => ({ value: item.id, label: item.name || item.id }))
			}
			isLoading = false
		})
	})

	let justConnected = $derived(page.url.searchParams.get('connected') === '1')

	// ── Group ordering ─────────────────────────────────────────────────────────
	const GROUP_ORDER = ['ads', 'social_media', 'media', 'llm', 'email', 'monitoring']
	const GROUP_LABELS: Record<string, string> = {
		ads: 'Advertising',
		social_media: 'Social Media',
		media: 'Media & Storage',
		llm: 'AI Providers',
		email: 'Email',
		monitoring: 'Monitoring'
	}

	const sortedGroups = $derived(GROUP_ORDER.filter((g) => providers.some((p) => p.group === g)))

	function providersInGroup(group: string) {
		return providers.filter((p) => p.group === group)
	}

	function integrationsForProvider(provider: string) {
		return integrations.filter((i) => i.provider === provider)
	}

	// ── Status display ────────────────────────────────────────────────────────
	const STATUS = {
		connected: {
			label: 'Connected',
			cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
			Icon: CheckCircle2
		},
		pending: {
			label: 'Not connected',
			cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
			Icon: XCircle
		},
		error: {
			label: 'Error',
			cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
			Icon: AlertCircle
		}
	} as const

	// ── Modal state ───────────────────────────────────────────────────────────
	let showModal = $state(false)
	let editingId = $state<string | null>(null)
	let activeProvider = $state<ProviderSchema | null>(null)
	let form = $state<Record<string, string>>({})
	let formName = $state('')
	let formTenants = $state<string[]>([])
	let showSecrets = $state<Record<string, boolean>>({})
	let isSubmitting = $state(false)
	let modalError = $state<string | null>(null)
	let testStatus = $state<{ ok: boolean; message: string } | null>(null)
	let isTesting = $state(false)

	function openCreate(provider: ProviderSchema) {
		editingId = null
		activeProvider = provider
		formName = ''
		form = {}
		formTenants = []
		showSecrets = {}
		modalError = null
		testStatus = null
		showModal = true
	}

	function openEdit(ig: Integration, provider: ProviderSchema) {
		editingId = ig.id
		activeProvider = provider
		formName = ig.name
		formTenants = [...ig.tenant_ids]
		showSecrets = {}
		modalError = null
		testStatus = null
		// Populate form from config (masked values stay as-is)
		form = {}
		for (const f of [...provider.config_fields, ...provider.credential_fields]) {
			form[f.key] = ig.config[f.key] ?? ''
		}
		showModal = true
	}

	// ── Delete state ──────────────────────────────────────────────────────────
	let showDelete = $state(false)
	let deletingId = $state<string | null>(null)
	let isDeleting = $state(false)

	function confirmDelete(id: string) {
		deletingId = id
		showDelete = true
	}

	// ── Helpers ───────────────────────────────────────────────────────────────
	function allFields(provider: ProviderSchema): FieldSchema[] {
		return [...(provider.config_fields ?? []), ...(provider.credential_fields ?? [])]
	}

	function credentialKeys(provider: ProviderSchema): Set<string> {
		return new Set((provider.credential_fields ?? []).map((f) => f.key))
	}

	function buildPayload() {
		if (!activeProvider) return null
		const credKeys = credentialKeys(activeProvider)
		const payload: Record<string, string | null | string[]> = {
			name: formName.trim(),
			provider: activeProvider.provider,
			tenant_ids: formTenants
		}
		for (const f of allFields(activeProvider)) {
			const v = form[f.key]?.trim() ?? ''
			if (credKeys.has(f.key)) {
				// Map credential field key to Integration field name
				const mapped = credentialFieldMap[f.key] ?? f.key
				payload[mapped] = v || null
			} else {
				const mapped = configFieldMap[f.key] ?? f.key
				payload[mapped] = v || null
			}
		}
		return payload
	}

	// Schema field keys → Integration field names
	const credentialFieldMap: Record<string, string> = {
		oauth_client_id: 'oauth_client_id',
		oauth_client_secret: 'oauth_client_secret'
	}
	const configFieldMap: Record<string, string> = {
		developer_token: 'developer_token',
		login_customer_id: 'login_customer_id'
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()
		if (!formName.trim() || !activeProvider) {
			modalError = 'Name is required'
			return
		}
		isSubmitting = true
		modalError = null
		testStatus = null
		try {
			const payload = buildPayload()!
			if (editingId) {
				const updated = await updateIntegration(editingId, payload as any)
				integrations = integrations.map((i) => (i.id === editingId ? updated : i))
			} else {
				const created = await createIntegration(payload as any)
				integrations = [...integrations, created]
				// If OAuth provider, redirect to start OAuth after save
				if (activeProvider.oauth_flow && activeProvider.oauth_start_path) {
					window.location.href = `${activeProvider.oauth_start_path}?integration_id=${created.id}`
					return
				}
			}
			showModal = false
		} catch (err) {
			modalError = err instanceof Error ? err.message : 'Save failed'
		} finally {
			isSubmitting = false
		}
	}

	async function handleTest() {
		if (!editingId) return
		isTesting = true
		testStatus = null
		try {
			const result = await testIntegration(editingId)
			testStatus = result.ok
				? { ok: true, message: 'Connection successful.' }
				: { ok: false, message: result.error ?? 'Connection failed.' }
		} catch {
			testStatus = { ok: false, message: 'Test request failed.' }
		} finally {
			isTesting = false
		}
	}

	async function handleDelete() {
		if (!deletingId) return
		isDeleting = true
		try {
			await deleteIntegration(deletingId)
			integrations = integrations.filter((i) => i.id !== deletingId)
			showDelete = false
			deletingId = null
		} catch {
			// keep dialog open on error
		} finally {
			isDeleting = false
		}
	}

	function providerForIntegration(ig: Integration): ProviderSchema | undefined {
		return providers.find((p) => p.provider === ig.provider)
	}
</script>

<div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- Header -->
	<div class="mb-8 flex items-center gap-3">
		<Link2 class="h-6 w-6 text-slate-400" />
		<div>
			<h1 class="text-xl font-bold text-slate-900 dark:text-white">Integrations</h1>
			<p class="text-sm text-slate-500 dark:text-slate-400">
				OAuth apps and API credentials shared across all clients
			</p>
		</div>
	</div>

	<!-- Connected banner -->
	{#if justConnected}
		<div
			class="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
		>
			<CheckCircle2 class="h-4 w-4 shrink-0" />
			Google Ads connected successfully. The integration is now active.
		</div>
	{/if}

	{#if isLoading}
		<div class="space-y-8">
			{#each Array(2) as _}
				<section>
					<Skeleton class="mb-3 h-4 w-24" />
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{#each Array(3) as _}
							<div
								class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
							>
								<div class="flex items-center gap-2.5">
									<Skeleton class="h-8 w-8 rounded-lg" />
									<div class="flex-1 space-y-2">
										<Skeleton class="h-4 w-24" />
										<Skeleton class="h-3 w-16" />
									</div>
								</div>
								<Skeleton class="mt-2 h-4 w-full" />
								<div class="mt-auto flex gap-2 pt-1">
									<Skeleton class="h-7 w-7 rounded-lg" />
									<Skeleton class="h-7 w-20 rounded-lg" />
									<Skeleton class="ml-auto h-7 w-7 rounded-lg" />
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{:else}
		<!-- Provider groups -->
		{#each sortedGroups as group (group)}
			{@const groupProviders = providersInGroup(group)}
			<section class="mb-8">
				<h2
					class="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
				>
					{GROUP_LABELS[group] ?? group}
				</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each groupProviders as provider (provider.provider)}
						<!-- Existing integrations for this provider -->
						{#each integrationsForProvider(provider.provider) as integration (integration.id)}
							{@const cfg = STATUS[integration.status as keyof typeof STATUS] ?? STATUS.pending}
							{@const StatusIcon = cfg.Icon}
							<div
								class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
							>
								<!-- Provider logo + name -->
								<div class="flex items-start justify-between gap-2">
									<div class="flex min-w-0 items-center gap-2.5">
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg"
										>
											<ProviderIcon provider={provider.provider} />
										</div>
										<div class="min-w-0">
											<p class="truncate text-sm font-semibold text-slate-900 dark:text-white">
												{integration.name}
											</p>
											<p class="text-xs text-slate-400 dark:text-slate-500">
												{provider.display_name}
											</p>
										</div>
									</div>
									<span
										class="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase {cfg.cls}"
									>
										<StatusIcon class="h-3 w-3" />{cfg.label}
									</span>
								</div>

								<!-- Tenant chips -->
								{#if integration.tenant_ids.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each integration.tenant_ids as tid (tid)}
											{@const opt = tenantOptions?.find(
												(o: { value: string; label: string }) => o.value === tid
											)}
											<span
												class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
											>
												{opt?.label ?? tid}
											</span>
										{/each}
									</div>
								{/if}

								{#if integration.status === 'error' && integration.error_message}
									<p class="truncate text-xs text-red-500">{integration.error_message}</p>
								{/if}

								<!-- Actions -->
								<div class="mt-auto flex items-center gap-2 pt-1">
									<button
										onclick={() => openEdit(integration, provider)}
										title="Edit"
										class="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
									>
										<Pencil class="h-3.5 w-3.5" />
									</button>

									{#if provider.oauth_flow && provider.oauth_start_path}
										<a
											href="{provider.oauth_start_path}?integration_id={integration.id}"
											class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
										>
											<Link2 class="h-3.5 w-3.5" />
											{integration.status === 'connected' ? 'Re-auth' : 'Connect'}
										</a>
									{/if}

									<button
										onclick={() => confirmDelete(integration.id)}
										title="Delete"
										class="ml-auto rounded-lg border border-slate-200 p-1.5 text-red-400 transition-colors hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-900/10"
									>
										<Trash2 class="h-3.5 w-3.5" />
									</button>
								</div>
							</div>
						{/each}

						<!-- Add card -->
						<button
							onclick={() => openCreate(provider)}
							class="flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-4 text-slate-400 transition-colors hover:border-indigo-300 hover:text-indigo-500 dark:border-slate-700 dark:text-slate-500 dark:hover:border-indigo-700 dark:hover:text-indigo-400"
						>
							<div class="h-8 w-8 opacity-60">
								<ProviderIcon provider={provider.provider} />
							</div>
							<span class="flex items-center gap-1 text-xs font-medium">
								Add {provider.display_name}
							</span>
						</button>
					{/each}
				</div>
			</section>
		{/each}

		{#if providers.length === 0}
			<div
				class="rounded-xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
			>
				<p class="text-sm text-slate-400">No providers available.</p>
			</div>
		{/if}
	{/if}
</div>

<!-- ── Setup modal ─────────────────────────────────────────────────────────── -->
<Dialog.Root bind:open={showModal}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/50" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
		>
			{#if activeProvider}
				<Dialog.Title class="mb-1 text-base font-bold text-slate-900 dark:text-white">
					{editingId ? `Edit ${activeProvider.display_name}` : `Add ${activeProvider.display_name}`}
				</Dialog.Title>
				<Dialog.Description class="mb-5 text-sm text-slate-500 dark:text-slate-400">
					{activeProvider.description}
				</Dialog.Description>

				<form onsubmit={handleSubmit} class="flex flex-col gap-4">
					<!-- Name -->
					<div>
						<label
							for="int-name"
							class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
						>
							Name <span class="text-red-400">*</span>
						</label>
						<input
							id="int-name"
							type="text"
							bind:value={formName}
							placeholder="e.g. Agency – Default Account"
							required
							class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
						/>
					</div>

					<!-- Dynamic fields from schema -->
					{#if activeProvider.config_fields?.length}
						<div class="flex flex-col gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
							<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
								Configuration
							</p>
							{#each activeProvider.config_fields as field (field.key)}
								<div>
									<label
										for="f-{field.key}"
										class="mb-1 block text-xs font-semibold text-slate-500"
									>
										{field.label}{#if field.required}
											<span class="text-red-400">*</span>{/if}
									</label>
									<input
										id="f-{field.key}"
										type={field.type === 'password'
											? showSecrets[field.key]
												? 'text'
												: 'password'
											: field.type === 'url'
												? 'url'
												: 'text'}
										bind:value={form[field.key]}
										placeholder={field.placeholder ?? ''}
										required={field.required}
										class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
									/>
									{#if field.help_text}
										<p class="mt-0.5 text-xs text-slate-400">{field.help_text}</p>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					{#if activeProvider.credential_fields?.length}
						<div class="flex flex-col gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
							<p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
								Credentials
							</p>
							{#each activeProvider.credential_fields as field (field.key)}
								<div>
									<label
										for="c-{field.key}"
										class="mb-1 block text-xs font-semibold text-slate-500"
									>
										{field.label}{#if field.required}
											<span class="text-red-400">*</span>{/if}
									</label>
									<div class="relative">
										<input
											id="c-{field.key}"
											type={field.type === 'password'
												? showSecrets[field.key]
													? 'text'
													: 'password'
												: 'text'}
											bind:value={form[field.key]}
											placeholder={field.placeholder ?? ''}
											required={field.required && !editingId}
											class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 font-mono text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
										/>
										{#if field.type === 'password'}
											<button
												type="button"
												onclick={() => {
													showSecrets[field.key] = !showSecrets[field.key]
												}}
												class="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
											>
												{#if showSecrets[field.key]}<EyeOff class="h-4 w-4" />{:else}<Eye
														class="h-4 w-4"
													/>{/if}
											</button>
										{/if}
									</div>
									{#if field.help_text}
										<p class="mt-0.5 text-xs text-slate-400">{field.help_text}</p>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					<!-- Tenant assignment -->
					<div>
						<p class="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase">
							Assign to clients
						</p>
						<MultiSelect
							bind:value={formTenants}
							options={data.tenantOptions ?? []}
							placeholder="Select clients…"
						/>
					</div>

					{#if activeProvider.oauth_flow && !editingId}
						<p
							class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
						>
							After saving, you'll be redirected to authorize via OAuth.
						</p>
					{/if}

					<!-- Test result -->
					{#if testStatus}
						<div
							class="rounded-lg px-3 py-2 text-sm {testStatus.ok
								? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
								: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}"
						>
							{testStatus.message}
						</div>
					{/if}

					{#if modalError}
						<p
							class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
						>
							{modalError}
						</p>
					{/if}

					<div class="mt-2 flex items-center justify-between gap-3">
						<div>
							{#if editingId}
								<button
									type="button"
									onclick={handleTest}
									disabled={isTesting}
									class="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
								>
									<FlaskConical class="h-3.5 w-3.5" />
									{isTesting ? 'Testing…' : 'Test'}
								</button>
							{/if}
						</div>
						<div class="flex gap-3">
							<Dialog.Close
								class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
							>
								Cancel
							</Dialog.Close>
							<button
								type="submit"
								disabled={isSubmitting}
								class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
							>
								{isSubmitting
									? 'Saving…'
									: activeProvider.oauth_flow && !editingId
										? 'Save & Connect'
										: 'Save'}
							</button>
						</div>
					</div>
				</form>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<ConfirmDialog
	bind:open={showDelete}
	title="Delete integration?"
	description="This will permanently remove the integration and disconnect all associated clients. This cannot be undone."
	confirmLabel="Delete"
	isLoading={isDeleting}
	onconfirm={handleDelete}
/>
