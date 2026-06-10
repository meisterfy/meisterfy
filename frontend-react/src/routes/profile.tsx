import { useState } from 'react'
import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, User, Key, Globe, Clock, CircleCheck } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { updateMe, changePassword } from '@/lib/api/users'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/profile')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: ProfileRoute,
})

const LOCALES: Record<string, string> = {
  pt_BR: 'Portuguese (BR)',
  en_US: 'English (US)',
  es_ES: 'Spanish',
}

const TIMEZONES: Record<string, string> = {
  'America/Sao_Paulo': 'America/Sao_Paulo (BRT)',
  'America/New_York': 'America/New_York (EST/EDT)',
  'Europe/London': 'Europe/London (GMT/BST)',
  UTC: 'UTC',
}

export function ProfileRoute() {
  const { t } = useTranslation('globals')
  const user = useAuth((s) => s.user)

  // ── Profile card state ─────────────────────────────────────────────────────
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [locale, setLocale] = useState(user?.locale ?? 'pt_BR')
  const [timezone, setTimezone] = useState(user?.timezone ?? 'America/Sao_Paulo')

  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setProfileError(null)
    setProfileSaving(true)
    try {
      const updated = await updateMe({ name, email, locale, timezone })
      useAuth.getState().setUser({ ...user!, ...updated })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2500)
    } catch (err) {
      setProfileError((err as { message?: string })?.message ?? 'Save failed')
    } finally {
      setProfileSaving(false)
    }
  }

  // ── Password card state ────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPwError(null)
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match')
      return
    }
    setPwSaving(true)
    try {
      const res = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      // The password change revoked the old token; adopt the fresh one so
      // this session keeps working.
      if (res?.access_token) useAuth.getState().setToken(res.access_token)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwSaved(true)
      setTimeout(() => setPwSaved(false), 2500)
    } catch (err) {
      setPwError((err as { message?: string })?.message ?? 'Password change failed')
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className='min-h-screen bg-slate-50 dark:bg-slate-950'>
      <header className='border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-slate-900'>
        <div className='mx-auto flex max-w-3xl items-center gap-4'>
          <Link
            to='/'
            className='flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
            aria-label={t('profile_back_aria')}
          >
            <ArrowLeft className='h-5 w-5' />
          </Link>
          <div>
            <h1 className='text-xl font-bold text-slate-900 dark:text-white'>
              {t('profile_title')}
            </h1>
            <p className='text-sm text-slate-500 dark:text-slate-400'>{t('profile_subtitle')}</p>
          </div>
        </div>
      </header>

      <main className='mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8'>
        {/* Personal Info + Preferences card */}
        <div className='rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
          <div className='mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800'>
            <User className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>
              {t('profile_personal_info')}
            </h2>
          </div>

          <form onSubmit={saveProfile} className='flex flex-col gap-5'>
            <div className='grid gap-5 sm:grid-cols-2'>
              <div>
                <label
                  htmlFor='profile-name'
                  className='mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase'
                >
                  {t('profile_full_name')} <span className='text-red-400'>*</span>
                </label>
                <Input
                  id='profile-name'
                  type='text'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor='profile-email'
                  className='mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase'
                >
                  Email <span className='text-red-400'>*</span>
                </label>
                <Input
                  id='profile-email'
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className='grid gap-5 sm:grid-cols-2'>
              <div>
                <label
                  htmlFor='profile-locale'
                  className='mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase'
                >
                  <Globe className='h-3.5 w-3.5' /> Language
                </label>
                <Select value={locale} onValueChange={(v) => v && setLocale(v as string)}>
                  <SelectTrigger id='profile-locale' className='w-full'>
                    <SelectValue>{LOCALES[locale] ?? locale}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOCALES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label
                  htmlFor='profile-timezone'
                  className='mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase'
                >
                  <Clock className='h-3.5 w-3.5' /> Timezone
                </label>
                <Select value={timezone} onValueChange={(v) => v && setTimezone(v as string)}>
                  <SelectTrigger id='profile-timezone' className='w-full'>
                    <SelectValue>{TIMEZONES[timezone] ?? timezone}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIMEZONES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {profileError && (
              <p
                role='alert'
                className='rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400'
              >
                {profileError}
              </p>
            )}

            <div className='flex items-center gap-3'>
              <button
                type='submit'
                disabled={profileSaving}
                className='rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50'
              >
                {profileSaving ? 'Saving…' : t('profile_save_changes')}
              </button>
              {profileSaved && (
                <span
                  data-testid='profile-saved'
                  className='flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400'
                >
                  <CircleCheck className='h-4 w-4' /> Saved
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Change Password card */}
        <div className='rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
          <div className='mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800'>
            <Key className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>
              {t('profile_change_password')}
            </h2>
          </div>

          <form onSubmit={savePassword} className='flex flex-col gap-5'>
            <div>
              <label
                htmlFor='profile-current-pwd'
                className='mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase'
              >
                {t('profile_current_password')}
              </label>
              <Input
                id='profile-current-pwd'
                type='password'
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className='grid gap-5 sm:grid-cols-2'>
              <div>
                <label
                  htmlFor='profile-new-pwd'
                  className='mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase'
                >
                  {t('profile_new_password')}
                </label>
                <Input
                  id='profile-new-pwd'
                  type='password'
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor='profile-confirm-pwd'
                  className='mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase'
                >
                  {t('profile_confirm_password')}
                </label>
                <Input
                  id='profile-confirm-pwd'
                  type='password'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {pwError && (
              <p
                role='alert'
                className='rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400'
              >
                {pwError}
              </p>
            )}

            <div className='flex items-center gap-3'>
              <button
                type='submit'
                disabled={pwSaving}
                className='rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50'
              >
                {pwSaving ? 'Saving…' : t('profile_change_password')}
              </button>
              {pwSaved && (
                <span
                  data-testid='pw-saved'
                  className='flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400'
                >
                  <CircleCheck className='h-4 w-4' />
                  {t('profile_password_updated')}
                </span>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
