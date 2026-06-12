import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Seo } from '@/components/seo'
import { useAuth } from '../store/auth'
import { setToken } from '../lib/api/client'

export function LoginRoute() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const auth = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('login_failed'))
        return
      }
      // Call the store's setToken (which already forwards to the client setToken),
      // then also call the client setToken directly to mirror the Svelte source exactly.
      // Calling both is idempotent.
      useAuth.getState().setToken(data.access_token)
      setToken(data.access_token)
      if (data.user) {
        auth.setUser({
          ...data.user,
          tenant_id: data.tenant_id ?? data.user.tenant_id ?? '',
          permissions: data.permissions ?? data.user.permissions ?? [],
        })
      }
      navigate({ to: data.needs_tenant ? '/tenants/new' : '/' })
    } catch {
      setError(t('network_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Seo title={t('title')} description={t('description')} />
      <div className="flex h-full min-h-screen flex-col items-center justify-center">
        <div className="border-primary/20 to-primary-700/10 relative z-10 flex w-full max-w-sm flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border-2 bg-linear-to-t from-transparent px-8 py-12 shadow-lg lg:max-w-lg lg:gap-6">
          <div className="w-28">
            <img
              src="/logo.svg"
              className="h-full w-full object-contain"
              alt={t('description')}
            />
          </div>
          <form
            onSubmit={submit}
            className="flex w-xs max-w-full flex-col gap-4 lg:gap-6"
          >
            <Label className="flex flex-col gap-1" htmlFor="login-email">
              {t('email')}
              <Input
                id="login-email"
                type="email"
                placeholder={t('email_placeholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Label>
            <Label className="flex flex-col gap-1" htmlFor="login-password">
              {t('password')}
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Label>
            {error && <Alert variant="destructive">{error}</Alert>}
            <Button type="submit" disabled={loading}>
              {loading ? t('signing_in') : t('sign_in')}
            </Button>
          </form>
          <div className="absolute top-0 left-0 -z-10 h-full w-full bg-linear-to-tr from-transparent via-transparent via-60% to-white/5" />
          <div className="bg-primary/5 absolute top-0 left-0 -z-10 h-full w-full rounded-[inherit] backdrop-blur-lg" />
        </div>
        <div className="bg-primary fixed top-1/2 left-1/2 z-0 mt-[-256px] ml-[-256px] h-[512px] w-[512px] rounded-full opacity-10 blur-3xl lg:mt-[-512px] lg:ml-[-512px] lg:opacity-5 xl:h-[1024px] xl:w-[1024px]" />
      </div>
    </>
  )
}
