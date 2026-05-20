<script lang="ts">
	import { KeyRound } from 'lucide-svelte'
	import { page } from '$app/state'
	import { m } from '$lib/paraglide/messages'
	import { auth } from '$lib/stores/auth.svelte'
	import type { PageData } from './$types'
	import type { McpApiKey, CreateMcpKeyResponse } from '$lib/api/mcp-keys'
	import { listMcpKeys, createMcpKey, revokeMcpKey } from '$lib/api/mcp-keys'
	import SettingsSkeleton from '../settings-skeleton.svelte'
	import SectionTitle from '$lib/components/ui/title/section-title.svelte'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import * as Dialog from '$lib/components/ui/dialog'
	import * as Select from '$lib/components/ui/select'
	import ConfirmDialog from '$lib/components/ui/dialog/confirm-dialog.svelte'
	import { toast } from 'svelte-sonner'

	let { data } = $props<{ data: PageData }>()

	let keys = $state<McpApiKey[]>([])
	let isLoading = $state(true)

	$effect(() => {
		isLoading = true
		data.keys.then((k: McpApiKey[]) => {
			keys = k
			isLoading = false
		})
	})

	let canManage = $derived(auth.user?.permissions?.includes('manage:mcp-keys') ?? false)

	let showCreateDialog = $state(false)
	let createName = $state('')
	let createRole = $state('readonly')
	let createExpires = $state('')
	let createLoading = $state(false)
	let createError = $state<string | null>(null)
	let createdKey = $state<CreateMcpKeyResponse | null>(null)

	let showRevokeDialog = $state(false)
	let revokeTarget = $state<McpApiKey | null>(null)
	let isRevoking = $state(false)

	let copiedKey = $state(false)
	let copiedUrl = $state(false)
	let copiedJson = $state(false)

	function openCreateDialog() {
		createName = ''
		createRole = 'readonly'
		createExpires = ''
		createError = null
		createdKey = null
		createLoading = false
		copiedKey = false
		copiedUrl = false
		copiedJson = false
		showCreateDialog = true
	}

	async function handleCreate() {
		createError = null
		if (!createName.trim()) return
		createLoading = true
		try {
			const result = await createMcpKey(data.tenant, {
				name: createName.trim(),
				role: createRole,
				...(createExpires ? { expires_at: new Date(createExpires).toISOString() } : {})
			})
			createdKey = result
		} catch {
			createError = 'Something went wrong'
		} finally {
			createLoading = false
		}
	}

	async function handleCreateDone() {
		showCreateDialog = false
		isLoading = true
		try {
			keys = await listMcpKeys(data.tenant)
		} finally {
			isLoading = false
		}
	}

	async function handleRevoke() {
		if (!revokeTarget) return
		isRevoking = true
		try {
			await revokeMcpKey(data.tenant, revokeTarget.id)
			keys = keys.filter((k) => k.id !== revokeTarget!.id)
			showRevokeDialog = false
			revokeTarget = null
			toast.success(m['settings:mcp_revoke_confirm']())
		} catch {
			toast.error('Failed to revoke key')
		} finally {
			isRevoking = false
		}
	}

	function formatDate(dateStr: string | null) {
		if (!dateStr) return m['settings:mcp_never']()
		return new Date(dateStr).toLocaleDateString()
	}

	function relativeTime(dateStr: string | null) {
		if (!dateStr) return m['settings:mcp_never']()
		const diff = Date.now() - new Date(dateStr).getTime()
		const days = Math.floor(diff / 86400000)
		if (days === 0) return 'Today'
		if (days === 1) return '1 day ago'
		return `${days} days ago`
	}

	function roleBadgeClass(role: string) {
		if (role === 'admin') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
		if (role === 'editor') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
		return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
	}

	function roleLabel(role: string) {
		if (role === 'admin') return m['settings:mcp_role_admin']()
		if (role === 'editor') return m['settings:mcp_role_editor']()
		return m['settings:mcp_role_readonly']()
	}

	let mcpUrl = $derived(`${page.url.origin}/mcp`)
	let tenantSlug = $derived(page.params.tenant)

	function copy(text: string, which: 'key' | 'url' | 'json') {
		navigator.clipboard.writeText(text)
		if (which === 'key') {
			copiedKey = true
			setTimeout(() => {
				copiedKey = false
			}, 2000)
		}
		if (which === 'url') {
			copiedUrl = true
			setTimeout(() => {
				copiedUrl = false
			}, 2000)
		}
		if (which === 'json') {
			copiedJson = true
			setTimeout(() => {
				copiedJson = false
			}, 2000)
		}
	}

	let jsonSnippet = $derived(
		createdKey
			? JSON.stringify(
					{
						mcpServers: {
							[`${tenantSlug}-maestro`]: {
								type: 'http',
								url: mcpUrl,
								headers: { Authorization: `Bearer ${createdKey.key}` }
							}
						}
					},
					null,
					2
				)
			: ''
	)
</script>

{#if isLoading}
	<SettingsSkeleton rows={5} />
{:else}
	<div class="flex flex-col gap-6 p-6">
		<SectionTitle title={m['settings:mcp_title']()}>
			{#snippet icon()}
				<KeyRound class="text-muted-foreground h-5 w-5" />
			{/snippet}
			{#if canManage}
				<Button onclick={openCreateDialog} class="flex h-9 items-center gap-2 px-3 text-sm">
					+ {m['settings:mcp_new_key']()}
				</Button>
			{/if}
		</SectionTitle>

		<p class="text-muted-foreground text-sm">{m['settings:mcp_desc']()}</p>

		{#if keys.length === 0}
			<div
				class="rounded-lg border border-dashed border-slate-200 py-12 text-center dark:border-slate-700"
			>
				<KeyRound class="text-muted-foreground mx-auto mb-3 h-8 w-8 opacity-40" />
				<p class="text-muted-foreground text-sm">{m['settings:mcp_empty']()}</p>
				{#if canManage}
					<Button onclick={openCreateDialog} class="mt-4 h-9 px-4 text-sm">
						+ {m['settings:mcp_new_key']()}
					</Button>
				{/if}
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-border border-b text-left">
							<th class="text-muted-foreground pr-4 pb-3 font-medium"
								>{m['settings:mcp_col_name']()}</th
							>
							<th class="text-muted-foreground pr-4 pb-3 font-medium"
								>{m['settings:mcp_col_role']()}</th
							>
							<th class="text-muted-foreground pr-4 pb-3 font-medium"
								>{m['settings:mcp_col_prefix']()}</th
							>
							<th class="text-muted-foreground pr-4 pb-3 font-medium"
								>{m['settings:mcp_col_created']()}</th
							>
							<th class="text-muted-foreground pr-4 pb-3 font-medium"
								>{m['settings:mcp_col_last_used']()}</th
							>
							<th class="text-muted-foreground pr-4 pb-3 font-medium"
								>{m['settings:mcp_col_expires']()}</th
							>
							<th class="pb-3"></th>
						</tr>
					</thead>
					<tbody>
						{#each keys as key (key.id)}
							<tr class="border-border border-b last:border-0">
								<td class="py-3 pr-4 font-medium">{key.name}</td>
								<td class="py-3 pr-4">
									<span
										class="rounded-full px-2 py-0.5 text-xs font-medium {roleBadgeClass(key.role)}"
									>
										{roleLabel(key.role)}
									</span>
								</td>
								<td class="py-3 pr-4">
									<code class="text-muted-foreground font-mono text-xs">{key.key_prefix}…</code>
								</td>
								<td class="text-muted-foreground py-3 pr-4">{formatDate(key.created_at)}</td>
								<td class="text-muted-foreground py-3 pr-4">{relativeTime(key.last_used_at)}</td>
								<td class="text-muted-foreground py-3 pr-4">{formatDate(key.expires_at)}</td>
								<td class="py-3 text-right">
									{#if canManage}
										<button
											class="text-muted-foreground hover:text-destructive text-sm transition-colors"
											onclick={() => {
												revokeTarget = key
												showRevokeDialog = true
											}}
										>
											{m['settings:mcp_revoke']()}
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
{/if}

<!-- create key dialog -->
<Dialog.Root bind:open={showCreateDialog}>
	<Dialog.Content class="max-w-lg p-0">
		<Dialog.Header class="border-border border-b px-6 py-4">
			<Dialog.Title>
				{createdKey ? m['settings:mcp_created_title']() : m['settings:mcp_create_title']()}
			</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4 px-6 py-5">
			{#if createdKey}
				<p class="text-sm font-medium text-amber-600 dark:text-amber-400">
					{m['settings:mcp_created_desc']()}
				</p>

				<!-- full key -->
				<div>
					<p class="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
						API Key
					</p>
					<div class="flex items-center gap-2">
						<code class="bg-muted flex-1 rounded px-3 py-2 font-mono text-xs break-all">
							{createdKey.key}
						</code>
						<button
							onclick={() => copy(createdKey!.key, 'key')}
							class="text-muted-foreground hover:text-foreground shrink-0 rounded border border-slate-200 px-2 py-1.5 text-xs transition-colors dark:border-slate-700"
						>
							{copiedKey ? m['settings:mcp_copied']() : m['settings:mcp_copy']()}
						</button>
					</div>
				</div>

				<!-- MCP URL -->
				<div>
					<p class="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
						{m['settings:mcp_created_mcp_url']()}
					</p>
					<div class="flex items-center gap-2">
						<code class="bg-muted flex-1 rounded px-3 py-2 font-mono text-xs">{mcpUrl}</code>
						<button
							onclick={() => copy(mcpUrl, 'url')}
							class="text-muted-foreground hover:text-foreground shrink-0 rounded border border-slate-200 px-2 py-1.5 text-xs transition-colors dark:border-slate-700"
						>
							{copiedUrl ? m['settings:mcp_copied']() : m['settings:mcp_copy']()}
						</button>
					</div>
				</div>

				<!-- JSON snippet -->
				<div>
					<p class="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
						{m['settings:mcp_created_json']()}
					</p>
					<div class="relative">
						<pre class="bg-muted overflow-x-auto rounded p-3 font-mono text-xs">{jsonSnippet}</pre>
						<button
							onclick={() => copy(jsonSnippet, 'json')}
							class="text-muted-foreground hover:text-foreground absolute top-2 right-2 rounded border border-slate-200 px-2 py-1 text-xs transition-colors dark:border-slate-700"
						>
							{copiedJson ? m['settings:mcp_copied']() : m['settings:mcp_copy']()}
						</button>
					</div>
				</div>
			{:else}
				<!-- form -->
				<div>
					<label
						for="create-name"
						class="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
					>
						{m['settings:mcp_create_field_name']()}
					</label>
					<Input
						id="create-name"
						bind:value={createName}
						placeholder={m['settings:mcp_create_field_name_placeholder']()}
						required
					/>
				</div>

				<div>
					<label
						for="create-role"
						class="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
					>
						{m['settings:mcp_create_field_role']()}
					</label>
					<Select.Root type="single" bind:value={createRole}>
						<Select.Trigger id="create-role" class="w-full">
							{roleLabel(createRole)}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="readonly">{m['settings:mcp_role_readonly']()}</Select.Item>
							<Select.Item value="editor">{m['settings:mcp_role_editor']()}</Select.Item>
							<Select.Item value="admin">{m['settings:mcp_role_admin']()}</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				<div>
					<label
						for="create-expires"
						class="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
					>
						{m['settings:mcp_create_field_expires']()}
					</label>
					<Input id="create-expires" type="date" bind:value={createExpires} />
				</div>

				{#if createError}
					<p
						class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
					>
						{createError}
					</p>
				{/if}
			{/if}
		</div>

		<Dialog.Footer class="border-border flex justify-end gap-2 border-t px-6 py-4">
			{#if createdKey}
				<Button onclick={handleCreateDone} class="h-10 px-6 text-sm">
					{m['settings:mcp_created_done']()}
				</Button>
			{:else}
				<Dialog.Close
					class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
				>
					Cancel
				</Dialog.Close>
				<Button
					onclick={handleCreate}
					disabled={createLoading || !createName.trim()}
					class="h-10 px-6 text-sm"
				>
					{createLoading ? '…' : m['settings:mcp_create_submit']()}
				</Button>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- revoke confirm -->
<ConfirmDialog
	bind:open={showRevokeDialog}
	title={m['settings:mcp_revoke_title']()}
	description={m['settings:mcp_revoke_desc']()}
	confirmLabel={m['settings:mcp_revoke_confirm']()}
	isLoading={isRevoking}
	onconfirm={handleRevoke}
/>
