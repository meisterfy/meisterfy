import { useEffect, useState } from 'react'
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
import { createTenantUser } from '@/lib/api/admin-users'
import type { AdminRole } from '@/lib/api/admin-users'
import { roleName, localeName, type TFn } from './user-helpers'

interface InviteDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: AdminRole[]
  tenant: string
  onInvited: () => void
}

const LOCALES = ['pt-BR', 'en'] as const

function InviteDrawer({ open, onOpenChange, roles, tenant, onInvited }: InviteDrawerProps) {
  const { t } = useTranslation('settings')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [locale, setLocale] = useState('pt-BR')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-init roleId when roles load or drawer opens
  useEffect(() => {
    if (open && roles.length && !roleId) {
      setRoleId(roles[0].id)
    }
  }, [open, roles, roleId])

  function resetFields() {
    setName('')
    setEmail('')
    setPassword('')
    setRoleId(roles[0]?.id ?? '')
    setLocale('pt-BR')
    setError(null)
  }

  async function handleInvite() {
    if (!name.trim() || !email.trim() || !password) return
    setLoading(true)
    setError(null)
    try {
      await createTenantUser(tenant, {
        name: name.trim(),
        email: email.trim(),
        password,
        role_id: roleId,
        locale,
      })
      onInvited()
      onOpenChange(false)
      resetFields()
      toast.success(t('users_toast_invited'))
    } catch (e: unknown) {
      const err = e as { status?: number }
      setError(err?.status === 409 ? t('users_error_email_taken') : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const saveDisabled = loading || !name.trim() || !email.trim() || password.length < 8

  const selectedRole = roles.find((r) => r.id === roleId)

  const labelClass = 'text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase'

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={t('users_invite_title')}>
      <div className="flex-1 space-y-5 overflow-y-auto py-2">
        {/* Name */}
        <div>
          <label htmlFor="invite-name" className={labelClass}>
            {t('users_invite_field_name')}
          </label>
          <Input
            id="invite-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={t('users_invite_field_name')}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="invite-email" className={labelClass}>
            {t('users_invite_field_email')}
          </label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label={t('users_invite_field_email')}
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="invite-password" className={labelClass}>
            {t('users_invite_field_password')}
          </label>
          <Input
            id="invite-password"
            type="password"
            value={password}
            minLength={8}
            onChange={(e) => setPassword(e.target.value)}
            aria-label={t('users_invite_field_password')}
          />
          {password && password.length < 8 && (
            <p className="mt-1 text-xs text-red-500">{t('users_password_min_length')}</p>
          )}
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
          onClick={handleInvite}
          disabled={saveDisabled}
          className="h-10 px-6 text-sm"
        >
          {loading ? '…' : t('users_invite_submit')}
        </Button>
      </div>
    </Drawer>
  )
}

export { InviteDrawer }
