import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/store/auth'
import { useUsersData } from '@/features/users/use-users-data'
import { UsersTable } from '@/features/users/users-table'
import { InviteDrawer } from '@/features/users/invite-drawer'
import { EditDrawer } from '@/features/users/edit-drawer'
import { ReactivateDrawer } from '@/features/users/reactivate-drawer'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SectionTitle } from '@/components/section-title'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { deactivateTenantUser } from '@/lib/api/admin-users'
import { setUserSystemRole } from '@/lib/api/legal'
import { cn } from '@/lib/utils'
import type { AdminUser } from '@/lib/api/admin-users'

export const Route = createFileRoute('/$tenant/settings/users')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: UsersRoute,
})

function UsersRoute() {
  const { tenant } = Route.useParams()
  const { t } = useTranslation('settings')
  const { t: tGlobals } = useTranslation('globals')

  // ── Auth-derived permission flags ──────────────────────────────────────────
  const user = useAuth((s) => s.user)
  const canCreate = user?.permissions?.includes('create:user') ?? false
  const canUpdate = user?.permissions?.includes('update:user') ?? false
  const canDelete = user?.permissions?.includes('delete:user') ?? false
  const currentUserId = user?.id ?? ''
  const isPlatformAdmin = user?.system_role === 'platform_admin'

  // ── Data ───────────────────────────────────────────────────────────────────
  const { users, inactiveUsers, roles, isLoading, refetch } = useUsersData({ tenant })

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active')

  const [showInviteDrawer, setShowInviteDrawer] = useState(false)

  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)

  const [showReactivateDrawer, setShowReactivateDrawer] = useState(false)
  const [reactivateTarget, setReactivateTarget] = useState<AdminUser | null>(null)

  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null)
  const [isDeactivating, setIsDeactivating] = useState(false)

  // ── Handlers ───────────────────────────────────────────────────────────────
  function openEdit(u: AdminUser) {
    setEditUser(u)
    setShowEditDrawer(true)
  }

  function openReactivate(u: AdminUser) {
    setReactivateTarget(u)
    setShowReactivateDrawer(true)
  }

  function onDeactivate(u: AdminUser) {
    setDeactivateTarget(u)
    setShowDeactivateDialog(true)
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return
    setIsDeactivating(true)
    try {
      await deactivateTenantUser(deactivateTarget.id, tenant)
      refetch()
      setShowDeactivateDialog(false)
      setDeactivateTarget(null)
      toast.success(t('users_toast_deactivated'))
    } catch {
      toast.error('Failed to deactivate user')
    } finally {
      setIsDeactivating(false)
    }
  }

  async function handleToggleSystemRole(u: AdminUser) {
    const newRole = u.system_role === 'platform_admin' ? 'user' : 'platform_admin'
    try {
      await setUserSystemRole(u.id, newRole)
      refetch()
      toast.success(t('users_toast_system_role_updated'))
    } catch {
      toast.error(tGlobals('error_generic'))
    }
  }

  // ── Loading skeleton (minimal inline — SettingsSkeleton not yet ported) ────
  if (isLoading) {
    return (
      <div className='flex flex-col gap-6 p-6'>
        <Skeleton className='h-10 w-48' />
        <div className='flex flex-col gap-3'>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className='h-12 w-full rounded-lg' />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className='flex flex-col gap-6 p-6' data-testid='users-page'>
        {/* Header */}
        <SectionTitle
          title={t('users_title')}
          icon={<Users className='text-muted-foreground h-5 w-5' />}
        >
          {canCreate && (
            <Button
              onClick={() => setShowInviteDrawer(true)}
              className='flex h-9 items-center gap-2 px-3 text-sm'
            >
              + {t('users_invite')}
            </Button>
          )}
        </SectionTitle>

        {/* Tab bar */}
        <div className='border-border flex gap-1 border-b'>
          <button
            className={cn(
              'px-4 pb-2 text-sm font-medium transition-colors',
              activeTab === 'active'
                ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab('active')}
          >
            {t('users_tab_active')} ({users.length})
          </button>
          <button
            className={cn(
              'px-4 pb-2 text-sm font-medium transition-colors',
              activeTab === 'inactive'
                ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab('inactive')}
          >
            {t('users_tab_inactive')} ({inactiveUsers.length})
          </button>
        </div>

        {/* Table */}
        {activeTab === 'active' ? (
          <UsersTable
            users={users}
            tab='active'
            canUpdate={canUpdate}
            canDelete={canDelete}
            isPlatformAdmin={isPlatformAdmin}
            currentUserId={currentUserId}
            onEdit={openEdit}
            onDeactivate={onDeactivate}
            onReactivate={openReactivate}
            onToggleSystemRole={handleToggleSystemRole}
          />
        ) : (
          <UsersTable
            users={inactiveUsers}
            tab='inactive'
            canUpdate={canUpdate}
            canDelete={canDelete}
            isPlatformAdmin={isPlatformAdmin}
            currentUserId={currentUserId}
            onEdit={openEdit}
            onDeactivate={onDeactivate}
            onReactivate={openReactivate}
            onToggleSystemRole={handleToggleSystemRole}
          />
        )}
      </div>

      {/* Drawers & dialogs — always rendered, controlled by open state */}
      <InviteDrawer
        open={showInviteDrawer}
        onOpenChange={setShowInviteDrawer}
        roles={roles}
        tenant={tenant}
        onInvited={refetch}
      />

      <EditDrawer
        open={showEditDrawer}
        onOpenChange={setShowEditDrawer}
        user={editUser}
        roles={roles}
        tenant={tenant}
        onSaved={refetch}
      />

      <ReactivateDrawer
        open={showReactivateDrawer}
        onOpenChange={setShowReactivateDrawer}
        user={reactivateTarget}
        roles={roles}
        tenant={tenant}
        onReactivated={refetch}
      />

      <ConfirmDialog
        open={showDeactivateDialog}
        onOpenChange={setShowDeactivateDialog}
        title={t('users_deactivate_confirm_btn')}
        description={
          deactivateTarget
            ? t('users_deactivate_confirm', { name: deactivateTarget.name })
            : ''
        }
        confirmLabel={t('users_deactivate_confirm_btn')}
        isLoading={isDeactivating}
        onConfirm={handleDeactivate}
      />
    </>
  )
}
