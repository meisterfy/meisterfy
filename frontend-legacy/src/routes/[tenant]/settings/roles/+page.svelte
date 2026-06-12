<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity'
	import { ShieldCheck, Plus, Trash2, Save, CheckSquare, Square } from 'lucide-svelte'
	import Drawer from '$lib/components/ui/drawer/drawer.svelte'
	import { m } from '$lib/paraglide/messages'
	import { auth } from '$lib/stores/auth.svelte'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import ConfirmDialog from '$lib/components/ui/dialog/confirm-dialog.svelte'
	import { toast } from 'svelte-sonner'
	import type { PageData } from './$types'
	import type { AdminRole, AdminPermission } from '$lib/api/admin-users'
	import { createRole, deleteRole, updateRole } from '$lib/api/admin-users'
	import SettingsSkeleton from '../settings-skeleton.svelte'
	import SectionTitle from '$lib/components/ui/title/section-title.svelte'
	import Card from '$lib/components/ui/card/card.svelte'

	function permLabel(name: string): string {
		const key = `permissions:${name.replace(/-/g, '_').replace(/:/g, '_')}` as keyof typeof m
		const fn = m[key]
		return typeof fn === 'function' ? (fn as () => string)() : name
	}

	function roleLabel(name: string): string {
		const key = `settings:roles_name_${name.replace(/-/g, '_')}` as keyof typeof m
		const fn = m[key]
		return typeof fn === 'function' ? (fn as () => string)() : name
	}

	let { data } = $props<{ data: PageData }>()

	let roles = $state<AdminRole[]>([])
	let allPermissions = $state<AdminPermission[]>([])
	let selectedRole = $state<AdminRole | null>(null)
	let isLoading = $state(true)

	$effect(() => {
		const rolesP = data.roles
		const permsP = data.allPermissions
		isLoading = true
		Promise.all([rolesP, permsP]).then(([r, p]) => {
			roles = r
			allPermissions = p
			if (!selectedRole && r.length) selectRole(r[0])
			isLoading = false
		})
	})

	let canCreate = $derived(auth.user?.permissions?.includes('create:role') ?? false)
	let canUpdate = $derived(auth.user?.permissions?.includes('update:role') ?? false)
	let canDelete = $derived(auth.user?.permissions?.includes('delete:role') ?? false)

	// Track pending permission changes for the selected role
	let pendingPerms = $state<Set<string>>(new SvelteSet())
	let pendingName = $state('')
	let hasPendingChanges = $derived(
		selectedRole != null &&
			!isSystemRole(selectedRole) &&
			(JSON.stringify([...pendingPerms].sort()) !==
				JSON.stringify([...(selectedRole.permissions ?? [])].sort()) ||
				pendingName !== selectedRole.name)
	)

	let showCreateModal = $state(false)
	let deleteTarget = $state<AdminRole | null>(null)
	let showDeleteDialog = $state(false)
	let isSaving = $state(false)
	let isDeleting = $state(false)
	let isCreating = $state(false)

	// Create form
	let newRoleName = $state('')
	let newRolePerms = $state<Set<string>>(new SvelteSet())

	const PERM_GROUPS: { key: string; label: () => string; match: (p: string) => boolean }[] = [
		{
			key: 'content',
			label: () => m['settings:roles_perm_group_content'](),
			match: (p) => p.includes('post') || p.includes('content')
		},
		{
			key: 'advertising',
			label: () => m['settings:roles_perm_group_advertising'](),
			match: (p) => p.includes('campaign') || p.includes('report') || p.includes('analytics')
		},
		{
			key: 'users',
			label: () => m['settings:roles_perm_group_users'](),
			match: (p) => p.includes('user') || p.includes('role') || p.includes('tenant')
		},
		{
			key: 'integrations',
			label: () => m['settings:roles_perm_group_integrations'](),
			match: (p) => p.includes('integration') || p.includes('automation')
		}
	]

	function isSystemRole(role: AdminRole) {
		return !role.tenant_id
	}

	function groupPermissions(permSet: Set<string>) {
		const all = allPermissions.map((p) => p.name)
		const covered = new SvelteSet<string>()
		const groups: { key: string; label: string; perms: { name: string; has: boolean }[] }[] = []

		for (const g of PERM_GROUPS) {
			const perms = all.filter((p) => g.match(p))
			perms.forEach((p) => covered.add(p))
			if (perms.length > 0) {
				groups.push({
					key: g.key,
					label: g.label(),
					perms: perms.map((p) => ({ name: p, has: permSet.has(p) }))
				})
			}
		}

		const others = all.filter((p) => !covered.has(p))
		if (others.length > 0) {
			groups.push({
				key: 'other',
				label: m['settings:roles_perm_group_other'](),
				perms: others.map((p) => ({ name: p, has: permSet.has(p) }))
			})
		}

		return groups
	}

	function selectRole(role: AdminRole) {
		selectedRole = role
		pendingPerms = new SvelteSet(role.permissions ?? [])
		pendingName = role.name
	}

	function togglePendingPerm(name: string) {
		const next = new SvelteSet(pendingPerms)
		if (next.has(name)) next.delete(name)
		else next.add(name)
		pendingPerms = next
	}

	function toggleNewRolePerm(name: string) {
		const next = new SvelteSet(newRolePerms)
		if (next.has(name)) next.delete(name)
		else next.add(name)
		newRolePerms = next
	}

	function toggleGroupPending(groupKey: string) {
		const g = PERM_GROUPS.find((x) => x.key === groupKey)
		const matchFn = g
			? g.match
			: (p: string) => {
					// for "other" group
					return !PERM_GROUPS.some((gx) => gx.match(p))
				}

		let allInGroup = true
		const groupPerms = allPermissions.filter((p) => matchFn(p.name))
		for (const p of groupPerms) {
			if (!pendingPerms.has(p.name)) {
				allInGroup = false
				break
			}
		}

		const next = new SvelteSet(pendingPerms)
		groupPerms.forEach((p) => {
			if (allInGroup) next.delete(p.name)
			else next.add(p.name)
		})
		pendingPerms = next
	}

	function toggleGroupNew(groupKey: string) {
		const g = PERM_GROUPS.find((x) => x.key === groupKey)
		const matchFn = g
			? g.match
			: (p: string) => {
					return !PERM_GROUPS.some((gx) => gx.match(p))
				}

		let allInGroup = true
		const groupPerms = allPermissions.filter((p) => matchFn(p.name))
		for (const p of groupPerms) {
			if (!newRolePerms.has(p.name)) {
				allInGroup = false
				break
			}
		}

		const next = new SvelteSet(newRolePerms)
		groupPerms.forEach((p) => {
			if (allInGroup) next.delete(p.name)
			else next.add(p.name)
		})
		newRolePerms = next
	}

	function selectAll(set: Set<string>, updateFn: (s: Set<string>) => void) {
		if (set.size === allPermissions.length) {
			updateFn(new SvelteSet())
		} else {
			updateFn(new SvelteSet(allPermissions.map((p) => p.name)))
		}
	}

	function showToast(msg: string, error = false) {
		if (error) toast.error(msg)
		else toast.success(msg)
	}

	async function handleSavePerms() {
		if (!selectedRole || isSystemRole(selectedRole)) return
		if (!pendingName.trim()) {
			showToast('Name is required', true)
			return
		}
		isSaving = true
		try {
			await updateRole(selectedRole.id, {
				name: pendingName.trim(),
				permissions: [...pendingPerms]
			})
			selectedRole.permissions = [...pendingPerms]
			selectedRole.name = pendingName.trim()
			roles = roles.map((r) =>
				r.id === selectedRole!.id
					? { ...r, permissions: [...pendingPerms], name: pendingName.trim() }
					: r
			)
			showToast(m['settings:roles_toast_saved']())
		} catch {
			showToast('Failed to save role', true)
		} finally {
			isSaving = false
		}
	}

	async function handleDelete() {
		if (!deleteTarget) return
		isDeleting = true
		try {
			await deleteRole(deleteTarget.id)
			const deletedId = deleteTarget.id
			roles = roles.filter((r) => r.id !== deletedId)
			if (selectedRole?.id === deletedId) {
				if (roles.length > 0) {
					selectRole(roles[0])
				} else {
					selectedRole = null
				}
			}
			deleteTarget = null
			showDeleteDialog = false
			showToast(m['settings:roles_toast_deleted']())
		} catch {
			showToast('Failed to delete role', true)
		} finally {
			isDeleting = false
		}
	}

	async function handleCreate() {
		if (!newRoleName.trim()) return
		isCreating = true
		try {
			const created = await createRole({ name: newRoleName.trim(), permissions: [...newRolePerms] })
			roles = [...roles, created]
			showCreateModal = false
			newRoleName = ''
			newRolePerms = new SvelteSet()
			selectRole(created)
			showToast(m['settings:roles_toast_created']())
		} catch {
			showToast('Failed to create role', true)
		} finally {
			isCreating = false
		}
	}
</script>

{#if isLoading}
	<SettingsSkeleton twoPanel rows={5} />
{:else}
	<div class="flex flex-col gap-6 p-6">
		<SectionTitle title={m['settings:roles_title']()}>
			{#snippet icon()}
				<ShieldCheck class="text-muted-foreground h-5 w-5" />
			{/snippet}
			{#if canCreate}
				<Button
					onclick={() => (showCreateModal = true)}
					class="flex h-9 items-center gap-2 px-3 text-sm"
				>
					<Plus class="h-4 w-4" />
					{m['settings:roles_new_role']()}
				</Button>
			{/if}
		</SectionTitle>

		<div class="grid gap-4 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
			<!-- roles list -->
			<div>
				<div class="text-primary mb-2 flex items-end justify-between text-xs font-semibold">
					<span>Name</span>
					<span>{m['settings:roles_permissions_label']()}</span>
				</div>
				<div class="border-border flex flex-col overflow-hidden rounded-md border">
					{#each roles as role (role.id)}
						<button
							class="border-border flex w-full items-center justify-between border-b px-3
py-3 text-left text-sm transition-colors last:border-b-0
{selectedRole?.id === role.id ? 'bg-bg-light border-border font-medium' : 'hover:bg-muted/50'}"
							onclick={() => selectRole(role)}
						>
							<span class="flex flex-row items-center justify-start gap-1.5 truncate">
								<h3 class="text-base font-semibold">
									{roleLabel(role.name)}
								</h3>
								<span
									class="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase {isSystemRole(
										role
									)
										? 'bg-muted text-muted-foreground'
										: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'}"
								>
									{isSystemRole(role)
										? m['settings:roles_system_badge']()
										: m['settings:roles_custom_badge']()}
								</span>
							</span>
							<div class="ml-2 flex shrink-0 items-center gap-1.5">
								<span
									class="rounded px-1.5 py-0.5 text-xs font-medium tabular-nums {isSystemRole(role)
										? 'bg-muted text-muted-foreground'
										: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'}"
								>
									{role.permissions?.length ?? 0}
								</span>
							</div>
						</button>
					{/each}
				</div>
			</div>

			<!-- role detail -->
			{#if selectedRole}
				{@const currentRole = selectedRole}
				{@const isSystem = isSystemRole(currentRole)}
				{@const groups = groupPermissions(
					isSystem ? new SvelteSet(currentRole.permissions ?? []) : pendingPerms
				)}

				<Card>
					{#snippet header()}
						<div class="flex items-center justify-between gap-4">
							<div class="flex flex-1 flex-col items-start gap-1">
								{#if !isSystem && canUpdate}
									<Input
										bind:value={pendingName}
										placeholder={m['settings:roles_create_field_name']()}
										class="h-9 max-w-[300px] text-base font-semibold"
									/>
								{:else}
									<h2 class="text-base font-semibold lg:text-xl">
										{roleLabel(currentRole.name)}
									</h2>
								{/if}
								{#if isSystem}
									<span class="text-xs font-medium opacity-50">
										{m['settings:roles_system_cannot_modify']()}
									</span>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								{#if !isSystem && canUpdate}
									<Button
										onclick={() => selectAll(pendingPerms, (s) => (pendingPerms = s))}
										variant="outline"
										class="h-9 px-3 text-xs"
									>
										{#if pendingPerms.size === allPermissions.length}
											<Square class="mr-1 h-3.5 w-3.5" /> {m['settings:roles_deselect_all']()}
										{:else}
											<CheckSquare class="mr-1 h-3.5 w-3.5" /> {m['settings:roles_select_all']()}
										{/if}
									</Button>
								{/if}
								{#if !isSystem && canUpdate && hasPendingChanges}
									<Button
										onclick={handleSavePerms}
										disabled={isSaving}
										variant="transparent"
										class="h-9"
									>
										<Save class="h-4 w-4" />
										<span class="max-lg:hidden">
											{isSaving ? '…' : m['settings:roles_save_changes']()}
										</span>
									</Button>
								{/if}
								{#if !isSystem && canDelete}
									<Button
										onclick={() => {
											deleteTarget = currentRole
											showDeleteDialog = true
										}}
										variant="red"
										class="h-9"
									>
										<Trash2 class="h-4 w-4" />
										<span class="max-lg:hidden"> Delete </span>
									</Button>
								{/if}
							</div>
						</div>
					{/snippet}

					<!-- permissions grid -->
					<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{#each groups as group (group.key)}
							<div>
								<div class="border-border mb-2.5 flex items-center justify-between border-b pb-2">
									<p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
										{group.label}
									</p>
									{#if !isSystem && canUpdate}
										{@const allChecked = group.perms.every((p) => p.has)}
										<button
											type="button"
											onclick={() => toggleGroupPending(group.key)}
											class="rounded px-1 py-0.5 text-[10px] font-semibold tracking-wider text-indigo-600 uppercase transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300"
										>
											{allChecked ? 'None' : 'All'}
										</button>
									{/if}
								</div>
								<div class="flex flex-col gap-1.5">
									{#each group.perms as perm (perm.name)}
										<label
											class="flex cursor-pointer items-center gap-2.5 rounded-md py-1 text-sm transition-colors {!isSystem &&
											canUpdate
												? 'hover:bg-muted/50'
												: ''}"
										>
											<input
												type="checkbox"
												checked={perm.has}
												disabled={isSystem || !canUpdate}
												onchange={() => togglePendingPerm(perm.name)}
												class="h-4 w-4 rounded border-slate-300 accent-indigo-600 disabled:cursor-default"
											/>
											<span class={perm.has ? '' : 'text-muted-foreground'}>
												{permLabel(perm.name)}
											</span>
										</label>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</Card>
			{:else}
				<div
					class="border-border bg-bg-light flex h-48 items-center justify-center rounded-xl border"
				>
					<p class="text-muted-foreground text-sm">
						{m['settings:roles_no_selection']()}
					</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- create role drawer -->
<Drawer bind:open={showCreateModal}>
	<div class="flex h-full flex-col">
		<div class="border-border flex items-center justify-between border-b px-6 py-4">
			<h2 class="text-lg font-bold text-slate-900 dark:text-white">
				{m['settings:roles_create_title']()}
			</h2>
			<Button onclick={() => (showCreateModal = false)} variant="outline" class="h-8 px-3 text-xs">
				Cancel
			</Button>
		</div>

		<div class="flex-1 space-y-6 overflow-y-auto px-6 py-6">
			<div>
				<label
					for="new-role-name"
					class="text-muted-foreground mb-1 block text-xs font-semibold tracking-wide uppercase"
				>
					{m['settings:roles_create_field_name']()}
				</label>
				<Input
					id="new-role-name"
					bind:value={newRoleName}
					placeholder={m['settings:roles_create_name_placeholder']()}
					class="max-w-[400px]"
				/>
			</div>

			<div>
				<div class="mb-4 flex items-center justify-between">
					<p class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
						{m['settings:roles_permissions_label']()}
					</p>
					<Button
						onclick={() => selectAll(newRolePerms, (s) => (newRolePerms = s))}
						variant="outline"
						class="h-8 px-3 text-xs"
					>
						{#if newRolePerms.size === allPermissions.length}
							<Square class="mr-1 h-3.5 w-3.5" /> {m['settings:roles_deselect_all']()}
						{:else}
							<CheckSquare class="mr-1 h-3.5 w-3.5" /> {m['settings:roles_select_all']()}
						{/if}
					</Button>
				</div>
				<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{#each groupPermissions(newRolePerms) as group (group.key)}
						{@const allChecked = group.perms.every((p) => p.has)}
						<div>
							<div class="border-border mb-2.5 flex items-center justify-between border-b pb-2">
								<p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
									{group.label}
								</p>
								<button
									type="button"
									onclick={() => toggleGroupNew(group.key)}
									class="rounded px-1 py-0.5 text-[10px] font-semibold tracking-wider text-indigo-600 uppercase transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300"
								>
									{allChecked ? 'None' : 'All'}
								</button>
							</div>
							<div class="flex flex-col gap-1.5">
								{#each group.perms as perm (perm.name)}
									<label
										class="hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 rounded py-1 text-sm transition-colors"
									>
										<input
											type="checkbox"
											checked={perm.has}
											onchange={() => toggleNewRolePerm(perm.name)}
											class="h-4 w-4 rounded border-slate-300 accent-indigo-600"
										/>
										<span class={perm.has ? '' : 'text-muted-foreground'}
											>{permLabel(perm.name)}</span
										>
									</label>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div class="border-border flex justify-end border-t px-6 py-4">
			<Button
				onclick={handleCreate}
				disabled={isCreating || !newRoleName.trim()}
				class="h-10 px-6 text-sm"
			>
				{isCreating ? '…' : m['settings:roles_create_submit']()}
			</Button>
		</div>
	</div>
</Drawer>

<!-- delete confirm -->
<ConfirmDialog
	bind:open={showDeleteDialog}
	title={m['settings:roles_delete_title']()}
	description={m['settings:roles_delete_description']()}
	confirmLabel={m['settings:roles_delete_confirm_btn']()}
	isLoading={isDeleting}
	onconfirm={handleDelete}
/>
