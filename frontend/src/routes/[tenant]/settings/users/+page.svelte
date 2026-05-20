<script lang="ts">
	import { Users, UserX, Pencil, UserCheck, ShieldCheck, ShieldOff } from 'lucide-svelte'
	import { m } from '$lib/paraglide/messages'
	import { auth } from '$lib/stores/auth.svelte'
	import type { PageData } from './$types'
	import type { AdminUser, AdminRole } from '$lib/api/admin-users'
	import {
		assignUserRole,
		createTenantUser,
		deactivateTenantUser,
		reactivateTenantUser,
		updateTenantUser
	} from '$lib/api/admin-users'
	import { setUserSystemRole } from '$lib/api/legal'
	import SettingsSkeleton from '../settings-skeleton.svelte'
	import SectionTitle from '$lib/components/ui/title/section-title.svelte'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import DataTable from '$lib/components/ui/data-table/data-table.svelte'
	import { renderSnippet } from '$lib/components/ui/data-table/index.js'
	import Drawer from '$lib/components/ui/drawer/drawer.svelte'
	import ConfirmDialog from '$lib/components/ui/dialog/confirm-dialog.svelte'
	import * as Select from '$lib/components/ui/select'
	import { toast } from 'svelte-sonner'
	import type { ColumnDef } from '@tanstack/table-core'

	let { data } = $props<{ data: PageData }>()

	let activeTab = $state<'active' | 'inactive'>('active')
	let users = $state<AdminUser[]>([])
	let inactiveUsers = $state<AdminUser[]>([])
	let roles = $state<AdminRole[]>([])
	let isLoading = $state(true)

	$effect(() => {
		isLoading = true
		Promise.all([data.users, data.inactiveUsers, data.roles]).then(([u, iu, r]) => {
			users = u
			inactiveUsers = iu
			roles = r
			isLoading = false
		})
	})

	let canCreate = $derived(auth.user?.permissions?.includes('create:user') ?? false)
	let canUpdate = $derived(auth.user?.permissions?.includes('update:user') ?? false)
	let canDelete = $derived(auth.user?.permissions?.includes('delete:user') ?? false)
	let currentUserId = $derived(auth.user?.id ?? '')
	let isPlatformAdmin = $derived(auth.user?.system_role === 'platform_admin')

	let showInviteDrawer = $state(false)
	let showEditDrawer = $state(false)
	let showDeactivateDialog = $state(false)
	let deactivateTarget = $state<AdminUser | null>(null)
	let editUser = $state<AdminUser | null>(null)

	// invite form
	let inviteName = $state('')
	let inviteEmail = $state('')
	let invitePassword = $state('')
	let inviteRoleId = $state('')
	$effect(() => {
		if (roles.length && !inviteRoleId) inviteRoleId = roles[0].id
	})
	let inviteLocale = $state('pt-BR')
	let inviteLoading = $state(false)
	let inviteError = $state<string | null>(null)

	// edit form
	let editName = $state('')
	let editEmail = $state('')
	let editLocale = $state('pt-BR')
	let editRoleId = $state('')
	let editLoading = $state(false)
	let editError = $state<string | null>(null)
	let isDeactivating = $state(false)

	// reactivate form
	let showReactivateDrawer = $state(false)
	let reactivateTarget = $state<AdminUser | null>(null)
	let reactivateRoleId = $state('')
	let reactivateLoading = $state(false)
	$effect(() => {
		if (roles.length && !reactivateRoleId) reactivateRoleId = roles[0].id
	})

	function openReactivateDrawer(user: AdminUser) {
		reactivateTarget = user
		reactivateRoleId = roles[0]?.id ?? ''
		showReactivateDrawer = true
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

	function localeName(locale: string) {
		if (locale === 'pt-BR') return m['settings:lang_pt_br']()
		return m['settings:lang_en_us']()
	}

	function roleName(role: { id: string; name: string } | undefined): string {
		if (!role) return '—'
		const key = `settings:roles_name_${role.name}` as keyof typeof m
		if (key in m) return (m[key] as () => string)()
		return role.name
	}

	function openEditDrawer(user: AdminUser) {
		editUser = user
		editName = user.name
		editEmail = user.email
		editLocale = user.locale ?? 'pt-BR'
		editRoleId = user.role?.id ?? roles[0]?.id ?? ''
		editError = null
		showEditDrawer = true
	}

	async function handleInvite() {
		inviteError = null
		if (!inviteName.trim() || !inviteEmail.trim() || !invitePassword) return
		inviteLoading = true
		try {
			const result = await createTenantUser(data.tenant, {
				name: inviteName.trim(),
				email: inviteEmail.trim(),
				password: invitePassword,
				role_id: inviteRoleId,
				locale: inviteLocale
			})
			// Backend returns 200 when reactivating an existing inactive user
			inactiveUsers = inactiveUsers.filter((u) => u.id !== result.id)
			users = [result, ...users.filter((u) => u.id !== result.id)]
			showInviteDrawer = false
			inviteName = ''
			inviteEmail = ''
			invitePassword = ''
			toast.success(m['settings:users_toast_invited']())
		} catch (e: unknown) {
			const err = e as { status?: number }
			inviteError =
				err?.status === 409 ? m['settings:users_error_email_taken']() : 'Something went wrong'
		} finally {
			inviteLoading = false
		}
	}

	async function handleReactivate() {
		if (!reactivateTarget) return
		reactivateLoading = true
		try {
			const reactivated = await reactivateTenantUser(
				reactivateTarget.id,
				data.tenant,
				reactivateRoleId
			)
			inactiveUsers = inactiveUsers.filter((u) => u.id !== reactivated.id)
			users = [reactivated, ...users]
			showReactivateDrawer = false
			reactivateTarget = null
			toast.success(m['settings:users_toast_reactivated']())
		} catch {
			toast.error('Failed to reactivate user')
		} finally {
			reactivateLoading = false
		}
	}

	async function handleEdit() {
		if (!editUser) return
		editError = null
		if (!editName.trim() || !editEmail.trim()) return
		editLoading = true
		try {
			const updated = await updateTenantUser(editUser.id, data.tenant, {
				name: editName.trim(),
				email: editEmail.trim(),
				locale: editLocale
			})
			if (editRoleId && editRoleId !== editUser.role?.id) {
				await assignUserRole(editUser.id, data.tenant, editRoleId)
				const matched = roles.find((r) => r.id === editRoleId)
				updated.role = matched ? { id: editRoleId, name: matched.name } : editUser.role
			} else {
				updated.role = editUser.role
			}
			users = users.map((u) => (u.id === updated.id ? updated : u))
			showEditDrawer = false
			editUser = null
			toast.success(m['settings:users_toast_updated']())
		} catch (e: unknown) {
			const err = e as { status?: number }
			editError =
				err?.status === 409 ? m['settings:users_error_email_taken']() : 'Something went wrong'
		} finally {
			editLoading = false
		}
	}

	async function handleDeactivate() {
		if (!deactivateTarget) return
		isDeactivating = true
		try {
			await deactivateTenantUser(deactivateTarget.id, data.tenant)
			inactiveUsers = [{ ...deactivateTarget, is_active: false }, ...inactiveUsers]
			users = users.filter((u) => u.id !== deactivateTarget!.id)
			showDeactivateDialog = false
			deactivateTarget = null
			toast.success(m['settings:users_toast_deactivated']())
		} catch {
			toast.error('Failed to deactivate user')
		} finally {
			isDeactivating = false
		}
	}

	async function handleToggleSystemRole(user: AdminUser): Promise<void> {
		const newRole = user.system_role === 'platform_admin' ? 'user' : 'platform_admin'
		try {
			await setUserSystemRole(user.id, newRole)
			users = users.map((u) => (u.id === user.id ? { ...u, system_role: newRole } : u))
			toast.success(m['settings:users_toast_system_role_updated']())
		} catch {
			toast.error(m['globals:error_generic']())
		}
	}

	const baseColumns: ColumnDef<AdminUser, unknown>[] = [
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
		}
	]

	let activeColumns = $derived<ColumnDef<AdminUser, unknown>[]>([
		...baseColumns,
		...(canUpdate || canDelete
			? [
					{
						id: 'actions',
						header: '',
						cell: ({ row }) => renderSnippet(actionsCell, { user: row.original })
					} as ColumnDef<AdminUser, unknown>
				]
			: [])
	])

	let inactiveColumns = $derived<ColumnDef<AdminUser, unknown>[]>([
		...baseColumns,
		...(canUpdate
			? [
					{
						id: 'actions',
						header: '',
						cell: ({ row }) => renderSnippet(inactiveActionsCell, { user: row.original })
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
	<span class="text-muted-foreground">{roleName(user.role)}</span>
{/snippet}

{#snippet actionsCell({ user }: { user: AdminUser })}
	{#if user.id !== currentUserId}
		<div class="flex items-center justify-end gap-2">
			{#if isPlatformAdmin}
				<button
					class="text-muted-foreground hover:text-foreground transition-colors"
					title={user.system_role === 'platform_admin'
						? m['settings:users_remove_platform_admin']()
						: m['settings:users_make_platform_admin']()}
					onclick={() => handleToggleSystemRole(user)}
				>
					{#if user.system_role === 'platform_admin'}
						<ShieldOff class="h-4 w-4" />
					{:else}
						<ShieldCheck class="h-4 w-4" />
					{/if}
				</button>
			{/if}
			{#if canUpdate}
				<button
					class="text-muted-foreground hover:text-foreground transition-colors"
					title="Edit user"
					onclick={() => openEditDrawer(user)}
				>
					<Pencil class="h-4 w-4" />
				</button>
			{/if}
			{#if canDelete}
				<button
					class="text-muted-foreground hover:text-destructive transition-colors"
					title={m['settings:users_deactivate_confirm_btn']()}
					onclick={() => {
						deactivateTarget = user
						showDeactivateDialog = true
					}}
				>
					<UserX class="h-4 w-4" />
				</button>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet inactiveActionsCell({ user }: { user: AdminUser })}
	<div class="flex items-center justify-end gap-2">
		<button
			class="text-muted-foreground transition-colors hover:text-emerald-600"
			title={m['settings:users_reactivate_title']()}
			onclick={() => openReactivateDrawer(user)}
		>
			<UserCheck class="h-4 w-4" />
		</button>
	</div>
{/snippet}

{#if isLoading}
	<SettingsSkeleton rows={6} />
{:else}
	<div class="flex flex-col gap-6 p-6">
		<SectionTitle title={m['settings:users_title']()}>
			{#snippet icon()}
				<Users class="text-muted-foreground h-5 w-5" />
			{/snippet}
			{#if canCreate}
				<Button
					onclick={() => (showInviteDrawer = true)}
					class="flex h-9 items-center gap-2 px-3 text-sm"
				>
					+ {m['settings:users_invite']()}
				</Button>
			{/if}
		</SectionTitle>

		<!-- tabs -->
		<div class="border-border flex gap-1 border-b">
			<button
				class="px-4 pb-2 text-sm font-medium transition-colors {activeTab === 'active'
					? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => (activeTab = 'active')}
			>
				{m['settings:users_tab_active']()} ({users.length})
			</button>
			<button
				class="px-4 pb-2 text-sm font-medium transition-colors {activeTab === 'inactive'
					? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => (activeTab = 'inactive')}
			>
				{m['settings:users_tab_inactive']()} ({inactiveUsers.length})
			</button>
		</div>

		{#if activeTab === 'active'}
			<DataTable
				data={users}
				columns={activeColumns}
				searchColumn="name"
				searchPlaceholder={m['settings:users_search_placeholder']?.() ?? 'Search users...'}
			/>
		{:else}
			<DataTable
				data={inactiveUsers}
				columns={inactiveColumns}
				searchColumn="name"
				searchPlaceholder={m['settings:users_search_placeholder']?.() ?? 'Search users...'}
			/>
		{/if}
	</div>
{/if}

<!-- invite drawer -->
<Drawer bind:open={showInviteDrawer}>
	<div class="flex h-full flex-col">
		<div class="border-border flex items-center justify-between border-b px-6 py-4">
			<h2 class="text-lg font-bold text-slate-900 dark:text-white">
				{m['settings:users_invite_title']()}
			</h2>
			<Button onclick={() => (showInviteDrawer = false)} variant="outline" class="h-8 px-3 text-xs">
				Cancel
			</Button>
		</div>

		<div class="flex-1 space-y-5 overflow-y-auto px-6 py-6">
			<div>
				<label
					for="invite-name"
					class="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
				>
					{m['settings:users_invite_field_name']()}
				</label>
				<Input id="invite-name" bind:value={inviteName} required />
			</div>

			<div>
				<label
					for="invite-email"
					class="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
				>
					{m['settings:users_invite_field_email']()}
				</label>
				<Input id="invite-email" type="email" bind:value={inviteEmail} required />
			</div>

			<div>
				<label
					for="invite-password"
					class="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
				>
					{m['settings:users_invite_field_password']()}
				</label>
				<Input
					id="invite-password"
					type="password"
					bind:value={invitePassword}
					minlength={8}
					required
				/>
				{#if invitePassword && invitePassword.length < 8}
					<p class="mt-1 text-xs text-red-500">Minimum 8 characters</p>
				{/if}
			</div>

			<div>
				<label
					for="invite-role"
					class="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
				>
					{m['settings:users_invite_field_role']()}
				</label>
				<Select.Root type="single" bind:value={inviteRoleId}>
					<Select.Trigger id="invite-role" class="w-full">
						{roleName(roles.find((r) => r.id === inviteRoleId))}
					</Select.Trigger>
					<Select.Content>
						{#each roles as role (role.id)}
							<Select.Item value={role.id}>{roleName(role)}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<div>
				<label
					for="invite-locale"
					class="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
				>
					{m['settings:users_invite_field_locale']()}
				</label>
				<Select.Root type="single" bind:value={inviteLocale}>
					<Select.Trigger id="invite-locale" class="w-full">
						{localeName(inviteLocale)}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="pt-BR">{m['settings:lang_pt_br']()}</Select.Item>
						<Select.Item value="en">{m['settings:lang_en_us']()}</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>

			{#if inviteError}
				<p
					class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
				>
					{inviteError}
				</p>
			{/if}
		</div>

		<div class="border-border flex justify-end border-t px-6 py-4">
			<Button
				onclick={handleInvite}
				disabled={inviteLoading ||
					!inviteName.trim() ||
					!inviteEmail.trim() ||
					invitePassword.length < 8}
				class="h-10 px-6 text-sm"
			>
				{inviteLoading ? '…' : m['settings:users_invite_submit']()}
			</Button>
		</div>
	</div>
</Drawer>

<!-- edit drawer -->
<Drawer bind:open={showEditDrawer}>
	<div class="flex h-full flex-col">
		<div class="border-border flex items-center justify-between border-b px-6 py-4">
			<h2 class="text-lg font-bold text-slate-900 dark:text-white">
				{m['settings:users_edit_title']()}
			</h2>
			<Button onclick={() => (showEditDrawer = false)} variant="outline" class="h-8 px-3 text-xs">
				Cancel
			</Button>
		</div>

		<div class="flex-1 space-y-5 overflow-y-auto px-6 py-6">
			<div>
				<label
					for="edit-name"
					class="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
				>
					{m['settings:users_invite_field_name']()}
				</label>
				<Input id="edit-name" bind:value={editName} required />
			</div>

			<div>
				<label
					for="edit-email"
					class="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
				>
					{m['settings:users_invite_field_email']()}
				</label>
				<Input id="edit-email" type="email" bind:value={editEmail} required />
			</div>

			<div>
				<label
					for="edit-role"
					class="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
				>
					{m['settings:users_invite_field_role']()}
				</label>
				<Select.Root type="single" bind:value={editRoleId}>
					<Select.Trigger id="edit-role" class="w-full">
						{roleName(roles.find((r) => r.id === editRoleId))}
					</Select.Trigger>
					<Select.Content>
						{#each roles as role (role.id)}
							<Select.Item value={role.id}>{roleName(role)}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<div>
				<label
					for="edit-locale"
					class="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
				>
					{m['settings:users_invite_field_locale']()}
				</label>
				<Select.Root type="single" bind:value={editLocale}>
					<Select.Trigger id="edit-locale" class="w-full">
						{localeName(editLocale)}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="pt-BR">{m['settings:lang_pt_br']()}</Select.Item>
						<Select.Item value="en">{m['settings:lang_en_us']()}</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>

			{#if editError}
				<p
					class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
				>
					{editError}
				</p>
			{/if}
		</div>

		<div class="border-border flex justify-end border-t px-6 py-4">
			<Button
				onclick={handleEdit}
				disabled={editLoading || !editName.trim() || !editEmail.trim()}
				class="h-10 px-6 text-sm"
			>
				{editLoading ? '…' : m['settings:users_edit_submit']()}
			</Button>
		</div>
	</div>
</Drawer>

<!-- reactivate drawer -->
<Drawer bind:open={showReactivateDrawer}>
	<div class="flex h-full flex-col">
		<div class="border-border flex items-center justify-between border-b px-6 py-4">
			<div>
				<h2 class="text-lg font-bold text-slate-900 dark:text-white">
					{m['settings:users_reactivate_title']()}
				</h2>
				{#if reactivateTarget}
					<p class="text-muted-foreground text-sm">
						{reactivateTarget.name} · {reactivateTarget.email}
					</p>
				{/if}
			</div>
			<Button
				onclick={() => (showReactivateDrawer = false)}
				variant="outline"
				class="h-8 px-3 text-xs"
			>
				Cancel
			</Button>
		</div>

		<div class="flex-1 space-y-5 overflow-y-auto px-6 py-6">
			<p class="text-muted-foreground text-sm">{m['settings:users_reactivate_description']()}</p>
			<div>
				<label
					for="reactivate-role"
					class="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
				>
					{m['settings:users_invite_field_role']()}
				</label>
				<Select.Root type="single" bind:value={reactivateRoleId}>
					<Select.Trigger id="reactivate-role" class="w-full">
						{roleName(roles.find((r) => r.id === reactivateRoleId))}
					</Select.Trigger>
					<Select.Content>
						{#each roles as role (role.id)}
							<Select.Item value={role.id}>{roleName(role)}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>

		<div class="border-border flex justify-end border-t px-6 py-4">
			<Button
				onclick={handleReactivate}
				disabled={reactivateLoading || !reactivateRoleId}
				class="h-10 px-6 text-sm"
			>
				{reactivateLoading ? '…' : m['settings:users_reactivate_submit']()}
			</Button>
		</div>
	</div>
</Drawer>

<!-- deactivate confirm -->
<ConfirmDialog
	bind:open={showDeactivateDialog}
	title={m['settings:users_deactivate_confirm_btn']()}
	description={deactivateTarget
		? m['settings:users_deactivate_confirm']({ name: deactivateTarget.name })
		: ''}
	confirmLabel={m['settings:users_deactivate_confirm_btn']()}
	isLoading={isDeactivating}
	onconfirm={handleDeactivate}
/>
