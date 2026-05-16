<script lang="ts">
	import { Users, UserX, Eye, EyeOff } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'
	import { auth } from '$lib/stores/auth.svelte'
	import type { PageData } from './$types'
	import type { AdminUser, AdminRole } from '$lib/api/admin-users'
	import { assignUserRole, createTenantUser, deactivateTenantUser } from '$lib/api/admin-users'
	import SettingsSkeleton from '../settings-skeleton.svelte'
	import SectionTitle from '$lib/components/ui/title/section-title.svelte'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import DataTable from '$lib/components/ui/data-table/data-table.svelte'
	import { renderSnippet } from '$lib/components/ui/data-table/index.js'
	import type { ColumnDef } from '@tanstack/table-core'

	let { data } = $props<{ data: PageData }>()

	let users = $state<AdminUser[]>([])
	let roles = $state<AdminRole[]>([])
	let isLoading = $state(true)

	$effect(() => {
		const usersP = data.users
		const rolesP = data.roles
		isLoading = true
		Promise.all([usersP, rolesP]).then(([u, r]) => {
			users = u
			roles = r
			isLoading = false
		})
	})

	let canManage = $derived(auth.user?.permissions?.includes('manage:user') ?? false)
	let currentUserId = $derived(auth.user?.id ?? '')

	let showInviteModal = $state(false)
	let confirmDeactivateUser = $state<AdminUser | null>(null)
	let toast = $state<string | null>(null)
	let toastError = $state(false)

	// invite form
	let inviteName = $state('')
	let inviteEmail = $state('')
	let invitePassword = $state('')
	let inviteShowPwd = $state(false)
	let inviteRoleId = $state('')
	$effect(() => {
		if (roles.length && !inviteRoleId) inviteRoleId = roles[0].id
	})
	let inviteLocale = $state('pt-BR')
	let inviteLoading = $state(false)
	let inviteError = $state<string | null>(null)

	function showToast(msg: string, error = false) {
		toast = msg
		toastError = error
		setTimeout(() => (toast = null), 3000)
	}

	function avatarColor(id: string) {
		const colors = [
			'bg-indigo-500',
			'bg-emerald-500',
			'bg-violet-500',
			'bg-rose-500',
			'bg-amber-500',
			'bg-cyan-500'
		]
		let hash = 0
		for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff
		return colors[hash % colors.length]
	}

	function initials(name: string) {
		return name
			.split(' ')
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase()
	}

	async function handleRoleChange(user: AdminUser, roleId: string) {
		try {
			await assignUserRole(user.id, roleId)
			const matched = roles.find((r) => r.id === roleId)
			user.role = matched ? { id: roleId, name: matched.name } : user.role
			users = [...users]
			showToast(m['settings:users_toast_role_updated']())
		} catch {
			showToast('Failed to update role', true)
		}
	}

	async function handleDeactivate() {
		if (!confirmDeactivateUser) return
		const target = confirmDeactivateUser
		confirmDeactivateUser = null
		try {
			await deactivateTenantUser(target.id)
			users = users.filter((u) => u.id !== target.id)
			showToast(m['settings:users_toast_deactivated']())
		} catch {
			showToast('Failed to deactivate user', true)
		}
	}

	async function handleInvite() {
		inviteError = null
		if (!inviteName.trim() || !inviteEmail.trim() || !invitePassword) return
		inviteLoading = true
		try {
			const created = await createTenantUser(data.tenant, {
				name: inviteName.trim(),
				email: inviteEmail.trim(),
				password: invitePassword,
				role_id: inviteRoleId,
				locale: inviteLocale
			})
			users = [created, ...users]
			showInviteModal = false
			inviteName = ''
			inviteEmail = ''
			invitePassword = ''
			showToast(m['settings:users_toast_invited']())
		} catch (e: unknown) {
			const err = e as { status?: number }
			inviteError =
				err?.status === 409 ? m['settings:users_error_email_taken']() : 'Something went wrong'
		} finally {
			inviteLoading = false
		}
	}

	let columns = $derived<ColumnDef<AdminUser, unknown>[]>([
		{
			accessorKey: 'name',
			header: m['settings:users_col_name'](),
			cell: ({ row }) => renderSnippet(nameCell, { user: row.original })
		},
		{
			accessorKey: 'email',
			header: m['settings:users_col_email'](),
			cell: ({ row }) => row.original.email
		},
		{
			id: 'role',
			accessorFn: (row) => row.role?.name ?? '',
			header: m['settings:users_col_role'](),
			cell: ({ row }) => renderSnippet(roleCell, { user: row.original })
		},
		{
			accessorKey: 'is_active',
			header: m['settings:users_col_status'](),
			cell: ({ row }) => renderSnippet(statusCell, { user: row.original })
		},
		...(canManage
			? [
					{
						id: 'actions',
						header: '',
						cell: ({ row }) => renderSnippet(actionsCell, { user: row.original })
					} as ColumnDef<AdminUser, unknown>
				]
			: [])
	])
</script>

{#snippet nameCell({ user }: { user: AdminUser })}
	<div class="flex items-center gap-3">
		<div
			class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white {avatarColor(
				user.id
			)}"
		>
			{initials(user.name)}
		</div>
		<span class="font-medium">{user.name}</span>
	</div>
{/snippet}

{#snippet roleCell({ user }: { user: AdminUser })}
	{#if canManage && user.id !== currentUserId}
		<select
			class="border-border bg-background h-8 rounded border px-2 text-sm"
			value={user.role?.id ?? ''}
			onchange={(e) => handleRoleChange(user, (e.target as HTMLSelectElement).value)}
		>
			{#if !user.role}
				<option value="">—</option>
			{/if}
			{#each roles as role (role.id)}
				<option value={role.id}>{role.name}</option>
			{/each}
		</select>
	{:else}
		<span class="text-muted-foreground">{user.role?.name ?? '—'}</span>
	{/if}
{/snippet}

{#snippet statusCell({ user }: { user: AdminUser })}
	{#if user.is_active}
		<span
			class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
		>
			{m['settings:users_status_active']()}
		</span>
	{:else}
		<span
			class="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
		>
			{m['settings:users_status_inactive']()}
		</span>
	{/if}
{/snippet}

{#snippet actionsCell({ user }: { user: AdminUser })}
	{#if user.id !== currentUserId && user.is_active}
		<div class="flex justify-end">
			<button
				class="text-muted-foreground hover:text-destructive transition-colors"
				title={m['settings:users_deactivate_confirm_btn']()}
				onclick={() => (confirmDeactivateUser = user)}
			>
				<UserX class="h-4 w-4" />
			</button>
		</div>
	{/if}
{/snippet}

{#if isLoading}
	<SettingsSkeleton rows={6} />
{:else}
	<div class="flex flex-col gap-6 p-6">
		<SectionTitle title={`${m['settings:users_title']()} (${users.length})`}>
			{#snippet icon()}
				<Users class="text-muted-foreground h-5 w-5" />
			{/snippet}
			{#if canManage}
				<Button
					onclick={() => (showInviteModal = true)}
					class="flex h-9 items-center gap-2 px-3 text-sm"
				>
					+ {m['settings:users_invite']()}
				</Button>
			{/if}
		</SectionTitle>

		<DataTable
			data={users}
			{columns}
			searchColumn="name"
			searchPlaceholder={m['settings:users_search_placeholder']?.() ?? 'Search users...'}
		/>
	</div>
{/if}

<!-- deactivate confirm dialog -->
{#if confirmDeactivateUser}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="bg-background border-border w-full max-w-sm rounded-lg border p-6 shadow-xl">
			<p class="mb-4 text-sm">
				{m['settings:users_deactivate_confirm']({ name: confirmDeactivateUser.name })}
			</p>
			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={() => (confirmDeactivateUser = null)}>Cancel</Button>
				<Button variant="red" onclick={handleDeactivate}>
					{m['settings:users_deactivate_confirm_btn']()}
				</Button>
			</div>
		</div>
	</div>
{/if}

<!-- invite modal -->
{#if showInviteModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="bg-background border-border w-full max-w-md rounded-lg border p-6 shadow-xl">
			<h2 class="mb-4 text-base font-semibold">{m['settings:users_invite_title']()}</h2>

			<div class="flex flex-col gap-4">
				<div>
					<label for="invite-name" class="text-muted-foreground mb-1 block text-xs font-medium">
						{m['settings:users_invite_field_name']()}
					</label>
					<Input id="invite-name" bind:value={inviteName} required />
				</div>

				<div>
					<label for="invite-email" class="text-muted-foreground mb-1 block text-xs font-medium">
						{m['settings:users_invite_field_email']()}
					</label>
					<Input id="invite-email" type="email" bind:value={inviteEmail} required />
				</div>

				<div>
					<label for="invite-password" class="text-muted-foreground mb-1 block text-xs font-medium">
						{m['settings:users_invite_field_password']()}
					</label>
					<div class="relative">
						<Input
							id="invite-password"
							type={inviteShowPwd ? 'text' : 'password'}
							class="pr-10"
							bind:value={invitePassword}
							minlength={8}
							required
						/>
						<button
							type="button"
							class="text-muted-foreground absolute top-2.5 right-3"
							onclick={() => (inviteShowPwd = !inviteShowPwd)}
						>
							{#if inviteShowPwd}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="invite-role" class="text-muted-foreground mb-1 block text-xs font-medium">
							{m['settings:users_invite_field_role']()}
						</label>
						<select
							id="invite-role"
							class="border-border bg-background w-full rounded-md border px-3 py-2 text-sm focus:ring-indigo-500"
							bind:value={inviteRoleId}
						>
							{#each roles as role (role.id)}
								<option value={role.id}>{role.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="invite-locale" class="text-muted-foreground mb-1 block text-xs font-medium">
							{m['settings:users_invite_field_locale']()}
						</label>
						<select
							id="invite-locale"
							class="border-border bg-background w-full rounded-md border px-3 py-2 text-sm focus:ring-indigo-500"
							bind:value={inviteLocale}
						>
							<option value="pt-BR">{m['settings:lang_pt_br']()}</option>
							<option value="en">{m['settings:lang_en_us']()}</option>
						</select>
					</div>
				</div>

				{#if inviteError}
					<p class="text-destructive text-sm font-medium">{inviteError}</p>
				{/if}
			</div>

			<div class="border-border mt-6 flex justify-end gap-2 border-t pt-4">
				<Button
					variant="outline"
					onclick={() => (showInviteModal = false)}
					disabled={inviteLoading}
				>
					Cancel
				</Button>
				<Button onclick={handleInvite} disabled={inviteLoading}>
					{inviteLoading ? '…' : m['settings:users_invite_submit']()}
				</Button>
			</div>
		</div>
	</div>
{/if}

<!-- toast -->
{#if toast}
	<div
		class="fixed right-6 bottom-6 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg {toastError
			? 'bg-destructive text-destructive-foreground'
			: 'bg-foreground text-background'}"
	>
		{toast}
	</div>
{/if}
