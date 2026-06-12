import { useTranslation } from 'react-i18next'
import type { AdminRole } from '@/lib/api/admin-users'
import { roleLabel, isSystemRole, type TFn } from '@/features/roles/roles-permissions'

interface RolesListProps {
  roles: AdminRole[]
  selectedRoleId: string | null
  onSelect: (role: AdminRole) => void
}

export function RolesList({ roles, selectedRoleId, onSelect }: RolesListProps) {
  const { t } = useTranslation('settings')

  return (
    <div>
      <div className='text-primary mb-2 flex items-end justify-between text-xs font-semibold'>
        <span>Name</span>
        <span>{t('roles_permissions_label')}</span>
      </div>
      <div className='border-border flex flex-col overflow-hidden rounded-md border'>
        {roles.map((role) => (
          <button
            key={role.id}
            className={[
              'border-border flex w-full items-center justify-between border-b px-3 py-3 text-left text-sm transition-colors last:border-b-0',
              selectedRoleId === role.id
                ? 'bg-bg-light border-border font-medium'
                : 'hover:bg-muted/50',
            ].join(' ')}
            onClick={() => onSelect(role)}
          >
            <span className='flex flex-row items-center justify-start gap-1.5 truncate'>
              <h3 className='text-base font-semibold'>{roleLabel(t as TFn, role.name)}</h3>
              <span
                className={[
                  'rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                  isSystemRole(role)
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
                ].join(' ')}
              >
                {isSystemRole(role) ? t('roles_system_badge') : t('roles_custom_badge')}
              </span>
            </span>
            <div className='ml-2 flex shrink-0 items-center gap-1.5'>
              <span
                className={[
                  'rounded px-1.5 py-0.5 text-xs font-medium tabular-nums',
                  isSystemRole(role)
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
                ].join(' ')}
              >
                {role.permissions?.length ?? 0}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
