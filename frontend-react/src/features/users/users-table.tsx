import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { type ColumnDef } from '@tanstack/react-table'
import { ShieldOff, ShieldCheck, Pencil, UserX, UserCheck } from 'lucide-react'

import { DataTable } from '@/components/ui/data-table'
import { cn } from '@/lib/utils'
import { avatarColor, initials, roleName, type TFn } from '@/features/users/user-helpers'
import type { AdminUser } from '@/lib/api/admin-users'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UsersTableProps {
  users: AdminUser[]
  tab: 'active' | 'inactive'
  canUpdate: boolean
  canDelete: boolean
  isPlatformAdmin: boolean
  currentUserId: string
  onEdit: (user: AdminUser) => void
  onDeactivate: (user: AdminUser) => void
  onReactivate: (user: AdminUser) => void
  onToggleSystemRole: (user: AdminUser) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function UsersTable({
  users,
  tab,
  canUpdate,
  canDelete,
  isPlatformAdmin,
  currentUserId,
  onEdit,
  onDeactivate,
  onReactivate,
  onToggleSystemRole,
}: UsersTableProps) {
  const { t } = useTranslation('settings')

  const columns = useMemo<ColumnDef<AdminUser>[]>(() => {
    const base: ColumnDef<AdminUser>[] = [
      {
        accessorKey: 'name',
        header: t('users_col_name'),
        cell: ({ row }) => {
          const user = row.original
          return (
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                  avatarColor(user.id),
                )}
              >
                {initials(user.name)}
              </div>
              <span className="font-medium">{user.name}</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'email',
        header: t('users_col_email'),
        cell: ({ row }) => row.original.email,
      },
      {
        id: 'role',
        accessorFn: (row) => row.role?.name ?? '',
        header: t('users_col_role'),
        cell: ({ row }) => {
          const user = row.original
          return (
            <span className="text-muted-foreground">{roleName(user.role, t as TFn)}</span>
          )
        },
      },
    ]

    if (tab === 'active') {
      if (canUpdate || canDelete || isPlatformAdmin) {
        base.push({
          id: 'actions',
          header: '',
          cell: ({ row }) => {
            const user = row.original
            if (user.id === currentUserId) return null
            return (
              <div className="flex items-center justify-end gap-2">
                {isPlatformAdmin && (
                  <button
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title={
                      user.system_role === 'platform_admin'
                        ? t('users_remove_platform_admin')
                        : t('users_make_platform_admin')
                    }
                    onClick={() => onToggleSystemRole(user)}
                  >
                    {user.system_role === 'platform_admin' ? (
                      <ShieldOff className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                  </button>
                )}
                {canUpdate && (
                  <button
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title={t('users_edit_user_aria')}
                    onClick={() => onEdit(user)}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title={t('users_deactivate_confirm_btn')}
                    onClick={() => onDeactivate(user)}
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                )}
              </div>
            )
          },
        })
      }
    } else {
      // inactive tab
      if (canUpdate) {
        base.push({
          id: 'actions',
          header: '',
          cell: ({ row }) => {
            const user = row.original
            return (
              <div className="flex items-center justify-end gap-2">
                <button
                  className="text-muted-foreground transition-colors hover:text-emerald-600"
                  title={t('users_reactivate_title')}
                  onClick={() => onReactivate(user)}
                >
                  <UserCheck className="h-4 w-4" />
                </button>
              </div>
            )
          },
        })
      }
    }

    return base
  }, [
    tab,
    canUpdate,
    canDelete,
    isPlatformAdmin,
    currentUserId,
    onEdit,
    onDeactivate,
    onReactivate,
    onToggleSystemRole,
    t,
  ])

  return <DataTable columns={columns} data={users} />
}

export { UsersTable }
