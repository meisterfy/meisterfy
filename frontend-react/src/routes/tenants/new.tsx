import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Seo } from '@/components/seo'
import { useAuth } from '@/store/auth'
import { createTenant } from '@/lib/api/tenants'

export const Route = createFileRoute('/tenants/new')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: NewTenantRoute,
})

function slugify(v: string) {
  return v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function NewTenantRoute() {
  const { t } = useTranslation('tenants')
  const { t: tGlobals } = useTranslation('globals')
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [id, setId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function onNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setName(next)
    // Auto-fill id from name until the user edits id manually
    if (!id || id === slugify(name)) {
      setId(slugify(next))
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await createTenant({ id, name, language: 'pt_BR' })
      await useAuth.getState().restoreSession()
      navigate({ to: '/' })
    } catch (err) {
      setError((err as { message?: string })?.message ?? t('create_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Seo title={t('create_first')} />
      <div className='flex h-full min-h-screen flex-col items-center justify-center'>
        <div className='border-primary/20 to-primary-700/10 relative z-10 flex w-full max-w-sm flex-col gap-6 overflow-hidden rounded-2xl border-2 bg-linear-to-t from-transparent px-8 py-12 shadow-lg lg:max-w-lg'>
          <div>
            <h1 className='text-xl font-bold tracking-tight text-slate-900 dark:text-white'>
              {t('create_first')}
            </h1>
            <p className='mt-1 text-sm text-slate-500'>{t('create_desc')}</p>
          </div>
          <form onSubmit={submit} className='flex flex-col gap-4'>
            <Label className='flex flex-col gap-1' htmlFor='tenant-name'>
              {t('create_field_name')}
              <Input
                id='tenant-name'
                type='text'
                placeholder={t('create_field_name_placeholder')}
                value={name}
                onChange={onNameChange}
                required
              />
            </Label>
            <Label className='flex flex-col gap-1' htmlFor='tenant-id'>
              {t('create_field_id')}
              <Input
                id='tenant-id'
                type='text'
                placeholder={t('create_field_id_placeholder')}
                value={id}
                onChange={(e) => setId(e.target.value)}
                pattern='[a-z0-9-]+'
                required
                className='font-mono'
              />
              <span className='text-xs text-slate-500'>{t('create_field_id_hint')}</span>
            </Label>
            {error && <Alert variant='destructive'>{error}</Alert>}
            <Button type='submit' disabled={loading}>
              {loading ? t('creating') : tGlobals('create_client')}
            </Button>
          </form>
          <div className='absolute top-0 left-0 -z-10 h-full w-full bg-linear-to-tr from-transparent via-transparent via-60% to-white/5' />
          <div className='bg-primary/5 absolute top-0 left-0 -z-10 h-full w-full rounded-[inherit] backdrop-blur-lg' />
        </div>
        <div className='bg-primary fixed top-1/2 left-1/2 z-0 mt-[-256px] ml-[-256px] h-[512px] w-[512px] rounded-full opacity-10 blur-3xl lg:mt-[-512px] lg:ml-[-512px] lg:opacity-5 xl:h-[1024px] xl:w-[1024px]' />
      </div>
    </>
  )
}
