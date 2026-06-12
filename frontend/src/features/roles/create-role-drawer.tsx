import { useTranslation } from 'react-i18next'
import { Square, CheckSquare } from 'lucide-react'
import type { AdminPermission } from '@/lib/api/admin-users'
import { groupPermissions, permLabel, type TFn } from '@/features/roles/roles-permissions'
import { PermissionsMatrix } from '@/features/roles/permissions-matrix'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CreateRoleDrawerProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  allPermissions: AdminPermission[]
  newRoleName: string
  onNameChange: (v: string) => void
  newRolePerms: Set<string>
  isCreating: boolean
  onSelectAll: () => void
  onTogglePerm: (name: string) => void
  onToggleGroup: (groupKey: string) => void
  onSubmit: () => void
}

export function CreateRoleDrawer({
  open,
  onOpenChange,
  allPermissions,
  newRoleName,
  onNameChange,
  newRolePerms,
  isCreating,
  onSelectAll,
  onTogglePerm,
  onToggleGroup,
  onSubmit,
}: CreateRoleDrawerProps) {
  const { t } = useTranslation('settings')
  const groups = groupPermissions(allPermissions, newRolePerms, t as TFn)
  const bound = (name: string) => permLabel(t as TFn, name)

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={t('roles_create_title')} headerless>
      <div className='flex h-full flex-col'>
        <div className='border-border flex items-center justify-between border-b px-6 py-4'>
          <h2 className='text-lg font-bold text-slate-900 dark:text-white'>
            {t('roles_create_title')}
          </h2>
          <Button
            variant='outline'
            className='h-8 px-3 text-xs'
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>

        <div className='flex-1 space-y-6 overflow-y-auto px-6 py-6'>
          <div>
            <label
              htmlFor='new-role-name'
              className='text-muted-foreground mb-1 block text-xs font-semibold tracking-wide uppercase'
            >
              {t('roles_create_field_name')}
            </label>
            <Input
              id='new-role-name'
              value={newRoleName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t('roles_create_name_placeholder')}
              className='max-w-[400px]'
            />
          </div>

          <div>
            <div className='mb-4 flex items-center justify-between'>
              <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                {t('roles_permissions_label')}
              </p>
              <Button variant='outline' className='h-8 px-3 text-xs' onClick={onSelectAll}>
                {newRolePerms.size === allPermissions.length ? (
                  <>
                    <Square className='mr-1 h-3.5 w-3.5' /> {t('roles_deselect_all')}
                  </>
                ) : (
                  <>
                    <CheckSquare className='mr-1 h-3.5 w-3.5' /> {t('roles_select_all')}
                  </>
                )}
              </Button>
            </div>
            <PermissionsMatrix
              groups={groups}
              editable
              variant='create'
              onTogglePerm={onTogglePerm}
              onToggleGroup={onToggleGroup}
              permLabel={bound}
              gridClassName='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'
            />
          </div>
        </div>

        <div className='border-border flex justify-end border-t px-6 py-4'>
          <Button
            className='h-10 px-6 text-sm'
            disabled={isCreating || !newRoleName.trim()}
            onClick={onSubmit}
          >
            {isCreating ? '…' : t('roles_create_submit')}
          </Button>
        </div>
      </div>
    </Drawer>
  )
}
