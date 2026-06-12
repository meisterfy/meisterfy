import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/store/auth'
import { useRolesData } from '@/features/roles/use-roles-data'
import { RolesList } from '@/features/roles/roles-list'
import { RoleDetailCard } from '@/features/roles/role-detail-card'
import { CreateRoleDrawer } from '@/features/roles/create-role-drawer'
import {
  isSystemRole,
  togglePerm,
  toggleGroup,
  selectAllToggle,
} from '@/features/roles/roles-permissions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SectionTitle } from '@/components/section-title'
import { SettingsSkeleton } from '@/components/settings-skeleton'
import { Button } from '@/components/ui/button'
import { createRole, updateRole, deleteRole } from '@/lib/api/admin-users'
import type { AdminRole } from '@/lib/api/admin-users'
import { Route } from './roles'

export function RolesRoute() {
  const { tenant: _tenant } = Route.useParams()
  const { t } = useTranslation('settings')

  // ── Data ───────────────────────────────────────────────────────────────────
  const { roles, setRoles, allPermissions, isLoading } = useRolesData()

  // ── Auth-derived permission flags ──────────────────────────────────────────
  const canCreate = useAuth(
    (s) => s.user?.permissions?.includes('create:role') ?? false,
  )
  const canUpdate = useAuth(
    (s) => s.user?.permissions?.includes('update:role') ?? false,
  )
  const canDelete = useAuth(
    (s) => s.user?.permissions?.includes('delete:role') ?? false,
  )

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selectedRole, setSelectedRole] = useState<AdminRole | null>(null)
  const [pendingPerms, setPendingPerms] = useState<Set<string>>(new Set())
  const [pendingName, setPendingName] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminRole | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Create form
  const [newRoleName, setNewRoleName] = useState('')
  const [newRolePerms, setNewRolePerms] = useState<Set<string>>(new Set())

  // ── Helpers ────────────────────────────────────────────────────────────────
  function selectRole(role: AdminRole) {
    setSelectedRole(role)
    setPendingPerms(new Set(role.permissions ?? []))
    setPendingName(role.name)
  }

  // Auto-select first role once data loads (adjust state during render)
  const [prevAuto, setPrevAuto] = useState<{
    isLoading: boolean
    roles: typeof roles
  } | null>(null)
  if (!prevAuto || isLoading !== prevAuto.isLoading || roles !== prevAuto.roles) {
    setPrevAuto({ isLoading, roles })
    if (!isLoading && !selectedRole && roles.length) {
      selectRole(roles[0])
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const hasPendingChanges = useMemo(
    () =>
      selectedRole != null &&
      !isSystemRole(selectedRole) &&
      (JSON.stringify([...pendingPerms].sort()) !==
        JSON.stringify([...(selectedRole.permissions ?? [])].sort()) ||
        pendingName !== selectedRole.name),
    [selectedRole, pendingPerms, pendingName],
  )

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleSavePerms() {
    if (!selectedRole || isSystemRole(selectedRole)) return
    if (!pendingName.trim()) {
      toast.error('Name is required')
      return
    }
    setIsSaving(true)
    try {
      await updateRole(selectedRole.id, {
        name: pendingName.trim(),
        permissions: [...pendingPerms],
      })
      const updated = {
        ...selectedRole,
        permissions: [...pendingPerms],
        name: pendingName.trim(),
      }
      setSelectedRole(updated)
      setRoles((rs) => rs.map((r) => (r.id === updated.id ? updated : r)))
      toast.success(t('roles_toast_saved'))
    } catch {
      toast.error('Failed to save role')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteRole(deleteTarget.id)
      const deletedId = deleteTarget.id
      const remaining = roles.filter((r) => r.id !== deletedId)
      setRoles(remaining)
      if (selectedRole?.id === deletedId) {
        if (remaining.length) {
          selectRole(remaining[0])
        } else {
          setSelectedRole(null)
        }
      }
      setDeleteTarget(null)
      setShowDeleteDialog(false)
      toast.success(t('roles_toast_deleted'))
    } catch {
      toast.error('Failed to delete role')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleCreate() {
    if (!newRoleName.trim()) return
    setIsCreating(true)
    try {
      const created = await createRole({
        name: newRoleName.trim(),
        permissions: [...newRolePerms],
      })
      setRoles((rs) => [...rs, created])
      setShowCreateModal(false)
      setNewRoleName('')
      setNewRolePerms(new Set())
      selectRole(created)
      toast.success(t('roles_toast_created'))
    } catch {
      toast.error('Failed to create role')
    } finally {
      setIsCreating(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <SettingsSkeleton twoPanel rows={5} />
  }

  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        <SectionTitle
          title={t('roles_title')}
          icon={<ShieldCheck className="text-muted-foreground h-5 w-5" />}
        >
          {canCreate && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="flex h-9 items-center gap-2 px-3 text-sm"
            >
              <Plus className="h-4 w-4" />
              {t('roles_new_role')}
            </Button>
          )}
        </SectionTitle>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
          <RolesList
            roles={roles}
            selectedRoleId={selectedRole?.id ?? null}
            onSelect={selectRole}
          />

          {selectedRole ? (
            <RoleDetailCard
              role={selectedRole}
              allPermissions={allPermissions}
              canUpdate={canUpdate}
              canDelete={canDelete}
              pendingPerms={pendingPerms}
              pendingName={pendingName}
              onNameChange={setPendingName}
              hasPendingChanges={hasPendingChanges}
              isSaving={isSaving}
              onSelectAll={() =>
                setPendingPerms((s) => selectAllToggle(s, allPermissions))
              }
              onSave={handleSavePerms}
              onDelete={() => {
                setDeleteTarget(selectedRole)
                setShowDeleteDialog(true)
              }}
              onTogglePerm={(n) => setPendingPerms((s) => togglePerm(s, n))}
              onToggleGroup={(k) =>
                setPendingPerms((s) => toggleGroup(allPermissions, s, k))
              }
            />
          ) : (
            <div className="border-border bg-bg-light flex h-48 items-center justify-center rounded-xl border">
              <p className="text-muted-foreground text-sm">
                {t('roles_no_selection')}
              </p>
            </div>
          )}
        </div>
      </div>

      <CreateRoleDrawer
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        allPermissions={allPermissions}
        newRoleName={newRoleName}
        onNameChange={setNewRoleName}
        newRolePerms={newRolePerms}
        isCreating={isCreating}
        onSelectAll={() =>
          setNewRolePerms((s) => selectAllToggle(s, allPermissions))
        }
        onTogglePerm={(n) => setNewRolePerms((s) => togglePerm(s, n))}
        onToggleGroup={(k) =>
          setNewRolePerms((s) => toggleGroup(allPermissions, s, k))
        }
        onSubmit={handleCreate}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t('roles_delete_title')}
        description={t('roles_delete_description')}
        confirmLabel={t('roles_delete_confirm_btn')}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
