import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Sparkles } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Seo } from '@/components/seo'
import { useAuth } from '../store/auth'
import { setToken } from '../lib/api/client'

export function SetupRoute() {
  const { t } = useTranslation('globals')
  const { t: tSettings } = useTranslation('settings')
  const navigate = useNavigate()
  const auth = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [needsTenant, setNeedsTenant] = useState(false)

  // Step 1 fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Setup failed')
        return
      }
      if (data.access_token) {
        useAuth.getState().setToken(data.access_token)
        setToken(data.access_token)
        if (data.user) {
          auth.setUser({
            ...data.user,
            tenant_id: data.tenant_id ?? data.user.tenant_id ?? '',
            permissions: data.permissions ?? data.user.permissions ?? [],
          })
        }
      }
      setNeedsTenant(!!data.needs_tenant)
      setStep(2)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  function skip() {
    navigate({ to: needsTenant ? '/tenants/new' : '/' })
  }

  return (
    <>
      <Seo title={t('setup_title')} />
      <div className="flex h-full min-h-screen items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
          {step === 1 ? (
            <>
              <h1 className="mb-2 text-xl font-bold text-foreground">
                {t('setup_title')}
              </h1>
              <p className="mb-6 text-sm text-muted-foreground">
                {t('setup_subtitle')}
              </p>
              <form onSubmit={submit} className="flex flex-col gap-4">
                <Label className="flex flex-col gap-1" htmlFor="setup-name">
                  Name
                  <Input
                    id="setup-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Label>
                <Label className="flex flex-col gap-1" htmlFor="setup-email">
                  Email
                  <Input
                    id="setup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Label>
                <Label className="flex flex-col gap-1" htmlFor="setup-password">
                  Password
                  <Input
                    id="setup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </Label>
                {error && <Alert variant="destructive">{error}</Alert>}
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating account…' : 'Create account'}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="mb-2 text-xl font-bold text-foreground">
                {t('setup_tools_title')}
              </h1>
              <p className="mb-6 text-sm text-muted-foreground">
                {t('setup_tools_subtitle')}
              </p>

              <div className="flex flex-col gap-3">
                {/* Google Ads card */}
                <div className="flex items-center gap-4 rounded-xl border border-border p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {tSettings('nav_google_ads')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('setup_gads_desc')}
                    </p>
                  </div>
                  {/* Plain anchor — backend OAuth start URL, not a typed route */}
                  <a
                    href="/auth/google-ads/start"
                    className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    Connect
                  </a>
                </div>

                {/* AI Provider card */}
                <div className="flex items-center gap-4 rounded-xl border border-border p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/20">
                    <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {t('setup_ai_provider')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('setup_ai_desc')}
                    </p>
                  </div>
                  {/* Plain anchor — /settings/integrations has required search params
                      that make typed navigate/Link awkward; home dashboard uses the
                      same pattern (plain <a href>) for the same reason. */}
                  <a
                    href="/settings/integrations"
                    className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    Configure
                  </a>
                </div>
              </div>

              <Button onClick={skip} variant="outline" className="mt-6 w-full">
                {t('setup_skip')}
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
