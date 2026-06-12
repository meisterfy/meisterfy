import { useTranslation } from 'react-i18next'
import { Save, Trash2, CheckSquare, Square } from 'lucide-react'
import type { AdminRole, AdminPermission } from '@/lib/api/admin-users'
import { isSystemRole, groupPermissions, permLabel, roleLabel, type TFn } from '@/features/roles/roles-permissions'
import { PermissionsMatrix } from '@/features/roles/permissions-matrix'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface RoleDetailCardProps {
  role: AdminRole
  allPermissions: AdminPermission[]
  canUpdate: boolean
  canDelete: boolean
  pendingPerms: Set<string>
  pendingName: string
  onNameChange: (v: string) => void
  hasPendingChanges: boolean
  isSaving: boolean
  onSelectAll: () => void
  onSave: () => void
  onDelete: () => void
  onTogglePerm: (name: string) => void
  onToggleGroup: (groupKey: string) => void
}

export function RoleDetailCard({
  role,
  allPermissions,
  canUpdate,
  canDelete,
  pendingPerms,
  pendingName,
  onNameChange,
  hasPendingChanges,
  isSaving,
  onSelectAll,
  onSave,
  onDelete,
  onTogglePerm,
  onToggleGroup,
}: RoleDetailCardProps) {
  const { t } = useTranslation('settings')
  const isSystem = isSystemRole(role)
  const permSet = isSystem ? new Set(role.permissions ?? []) : pendingPerms
  const groups = groupPermissions(allPermissions, permSet, t as TFn)
  const bound = (name: string) => permLabel(t as TFn, name)

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between gap-4'>
          <div className='flex flex-1 flex-col items-start gap-1'>
            {!isSystem && canUpdate ? (
              <Input
                value={pendingName}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder={t('roles_create_field_name')}
                className='h-9 max-w-[300px] text-base font-semibold'
              />
            ) : (
              <h2 className='text-base font-semibold lg:text-xl'>{roleLabel(t as TFn, role.name)}</h2>
            )}
            {isSystem && (
              <span className='text-xs font-medium opacity-50'>
                {t('roles_system_cannot_modify')}
              </span>
            )}
          </div>
          <div className='flex items-center gap-2'>
            {!isSystem && canUpdate && (
              <Button variant='outline' className='h-9 px-3 text-xs' onClick={onSelectAll}>
                {pendingPerms.size === allPermissions.length ? (
                  <>
                    <Square className='mr-1 h-3.5 w-3.5' /> {t('roles_deselect_all')}
                  </>
                ) : (
                  <>
                    <CheckSquare className='mr-1 h-3.5 w-3.5' /> {t('roles_select_all')}
                  </>
                )}
              </Button>
            )}
            {!isSystem && canUpdate && hasPendingChanges && (
              <Button variant='ghost' className='h-9' disabled={isSaving} onClick={onSave}>
                <Save className='h-4 w-4' />
                <span className='max-lg:hidden'>{isSaving ? '…' : t('roles_save_changes')}</span>
              </Button>
            )}
            {!isSystem && canDelete && (
              <Button variant='destructive' className='h-9' onClick={onDelete}>
                <Trash2 className='h-4 w-4' />
                <span className='max-lg:hidden'> Delete </span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <div className='px-4'>
        <PermissionsMatrix
          groups={groups}
          editable={!isSystem && canUpdate}
          variant='detail'
          onTogglePerm={onTogglePerm}
          onToggleGroup={onToggleGroup}
          permLabel={bound}
          gridClassName='grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        />
      </div>
    </Card>
  )
}
