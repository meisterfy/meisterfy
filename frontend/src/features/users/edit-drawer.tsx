import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateTenantUser, assignUserRole } from '@/lib/api/admin-users'
import type { AdminUser, AdminRole } from '@/lib/api/admin-users'
import { roleName, localeName, type TFn } from './user-helpers'

interface EditDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AdminUser | null
  roles: AdminRole[]
  tenant: string
  onSaved: () => void
}

const LOCALES = ['pt-BR', 'en'] as const

function EditDrawer({ open, onOpenChange, user, roles, tenant, onSaved }: EditDrawerProps) {
  const { t } = useTranslation('settings')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [locale, setLocale] = useState('pt-BR')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync fields when the drawer opens / user / roles change (adjust during render)
  const [prevSync, setPrevSync] = useState<{
    open: boolean
    user: typeof user
    roles: typeof roles
  } | null>(null)
  if (
    !prevSync ||
    open !== prevSync.open ||
    user !== prevSync.user ||
    roles !== prevSync.roles
  ) {
    setPrevSync({ open, user, roles })
    if (open && user) {
      setName(user.name)
      setEmail(user.email)
      setLocale(user.locale ?? 'pt-BR')
      setRoleId(user.role?.id ?? roles[0]?.id ?? '')
      setError(null)
    }
  }

  async function handleEdit() {
    if (!user) return
    setError(null)
    if (!name.trim() || !email.trim()) return
    setLoading(true)
    try {
      await updateTenantUser(user.id, tenant, {
        name: name.trim(),
        email: email.trim(),
        locale,
      })
      if (roleId && roleId !== user.role?.id) {
        await assignUserRole(user.id, tenant, roleId)
      }
      onSaved()
      onOpenChange(false)
      toast.success(t('users_toast_updated'))
    } catch (e: unknown) {
      const err = e as { status?: number }
      setError(err?.status === 409 ? t('users_error_email_taken') : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const saveDisabled = loading || !name.trim() || !email.trim()

  const selectedRole = roles.find((r) => r.id === roleId)

  const labelClass = 'text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase'

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={t('users_edit_title')}>
      {user ? (
        <>
          <div className="flex-1 space-y-5 overflow-y-auto py-2">
            {/* Name */}
            <div>
              <label htmlFor="edit-name" className={labelClass}>
                {t('users_invite_field_name')}
              </label>
              <Input
                id="edit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label={t('users_invite_field_name')}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="edit-email" className={labelClass}>
                {t('users_invite_field_email')}
              </label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label={t('users_invite_field_email')}
              />
            </div>

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

            {/* Locale */}
            <div>
              <p className={labelClass}>{t('users_invite_field_locale')}</p>
              <Select value={locale} onValueChange={(v) => setLocale(v ?? 'pt-BR')}>
                <SelectTrigger className="w-full">
                  <SelectValue>{localeName(locale, t as TFn)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {localeName(loc, t as TFn)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Error */}
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </p>
            )}
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
              onClick={handleEdit}
              disabled={saveDisabled}
              className="h-10 px-6 text-sm"
            >
              {loading ? '…' : t('users_edit_submit')}
            </Button>
          </div>
        </>
      ) : null}
    </Drawer>
  )
}

export { EditDrawer }
