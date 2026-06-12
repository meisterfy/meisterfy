import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { reactivateTenantUser } from '@/lib/api/admin-users'
import type { AdminUser, AdminRole } from '@/lib/api/admin-users'
import { roleName, type TFn } from './user-helpers'

interface ReactivateDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AdminUser | null
  roles: AdminRole[]
  tenant: string
  onReactivated: () => void
}

function ReactivateDrawer({
  open,
  onOpenChange,
  user,
  roles,
  tenant,
  onReactivated,
}: ReactivateDrawerProps) {
  const { t } = useTranslation('settings')

  const [roleId, setRoleId] = useState('')
  const [loading, setLoading] = useState(false)

  // Init roleId when the drawer opens / roles change (adjust state during render)
  const [prevSync, setPrevSync] = useState<{
    open: boolean
    roles: typeof roles
  } | null>(null)
  if (!prevSync || open !== prevSync.open || roles !== prevSync.roles) {
    setPrevSync({ open, roles })
    if (open && roles.length) {
      setRoleId(roles[0].id)
    }
  }

  async function handleReactivate() {
    if (!user) return
    setLoading(true)
    try {
      await reactivateTenantUser(user.id, tenant, roleId)
      onReactivated()
      onOpenChange(false)
      toast.success(t('users_toast_reactivated'))
    } catch {
      toast.error('Failed to reactivate user')
    } finally {
      setLoading(false)
    }
  }

  const selectedRole = roles.find((r) => r.id === roleId)

  const labelClass = 'text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase'

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={t('users_reactivate_title')}>
      <div className="flex-1 space-y-5 overflow-y-auto py-2">
        {/* User info subtitle */}
        {user && (
          <p className="text-muted-foreground text-sm">
            {user.name} · {user.email}
          </p>
        )}

        {/* Description */}
        <p className="text-muted-foreground text-sm">{t('users_reactivate_description')}</p>

        {/* Role */}
        <div>
          <p className={labelClass}>{t('users_invite_field_role')}</p>
          <Select value={roleId} onValueChange={(v) => setRoleId(v ?? '')}>
            <SelectTrigger className="w-full">
              <SelectValue>{roleName(selectedRole, t as TFn)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {roleName(role, t as TFn)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="h-10 px-6 text-sm"
        >
          Cancel
        </Button>
        <Button
          onClick={handleReactivate}
          disabled={loading || !roleId}
          className="h-10 px-6 text-sm"
        >
          {loading ? '…' : t('users_reactivate_submit')}
        </Button>
      </div>
    </Drawer>
  )
}

export { ReactivateDrawer }
