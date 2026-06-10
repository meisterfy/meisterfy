import { useEffect, useRef, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { getTenant, updateTenant } from '@/lib/api/tenants'
import { qk, fallbackQuery } from '@/lib/query'
import { parseHashtags } from '@/lib/utils/hashtags'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/$tenant/settings/general')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: GeneralSettingsRoute,
})

export function GeneralSettingsRoute() {
  const { tenant } = Route.useParams()
  const { t } = useTranslation('settings')
  const { t: tGlobals } = useTranslation('globals')

  const tenantQuery = useQuery({
    queryKey: qk.tenant(tenant),
    queryFn: () => fallbackQuery(() => getTenant(tenant), null),
  })

  // ── Form state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [language, setLanguage] = useState('pt_BR')
  const [location, setLocation] = useState('')
  const [primary_persona, setPrimaryPersona] = useState('')
  const [tone, setTone] = useState('')
  const [instructions, setInstructions] = useState('')
  const [hashtags_raw, setHashtagsRaw] = useState('')

  // ── Seed once when data arrives — guard so it doesn't clobber user edits ──
  const seeded = useRef(false)
  useEffect(() => {
    if (tenantQuery.data && !seeded.current) {
      const d = tenantQuery.data
      setName(d.name ?? '')
      setNiche(d.niche ?? '')
      setLanguage(d.language ?? 'pt_BR')
      setLocation(d.location ?? '')
      setPrimaryPersona(d.primary_persona ?? '')
      setTone(d.tone ?? '')
      setInstructions(d.instructions ?? '')
      setHashtagsRaw((d.hashtags ?? []).join(' '))
      seeded.current = true
    }
  }, [tenantQuery.data])

  // ── Save state ─────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) {
      setErrorMsg(t('error_required_name'))
      return
    }
    setErrorMsg(null)
    setIsSaving(true)
    try {
      await updateTenant(tenant, {
        name: name.trim(),
        niche: niche.trim() || null,
        language: language.trim() || 'pt_BR',
        location: location.trim() || null,
        primary_persona: primary_persona.trim() || null,
        tone: tone.trim() || null,
        instructions: instructions.trim() || null,
        hashtags: parseHashtags(hashtags_raw),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : tGlobals('error_generic'))
    } finally {
      setIsSaving(false)
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (tenantQuery.isLoading && !tenantQuery.data) {
    return (
      <div className='mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8'>
        <div className='flex flex-col gap-5'>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className='h-10 w-full rounded-lg' />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8'>
      <div className='flex flex-col gap-6 lg:flex-row lg:gap-8'>
        <div className='lg:w-1/3'>
          <h2 className='text-base font-semibold text-slate-900 dark:text-white'>
            {t('brand_identity_title')}
          </h2>
          <p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>
            {t('brand_identity_desc')}
          </p>
        </div>

        <div className='flex-1'>
          <form
            onSubmit={save}
            data-testid='general-settings-form'
            className='rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900'
          >
            <div className='flex flex-col gap-5'>
              {/* Row 1: name + niche */}
              <div className='grid gap-5 sm:grid-cols-2'>
                <div>
                  <label
                    htmlFor='brand-name'
                    className='mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase'
                  >
                    {t('field_brand_name')} <span className='text-red-400'>*</span>
                  </label>
                  <Input
                    id='brand-name'
                    type='text'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor='brand-niche'
                    className='mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase'
                  >
                    {t('field_niche')}
                  </label>
                  <Input
                    id='brand-niche'
                    type='text'
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder={t('placeholder_niche')}
                  />
                </div>
              </div>

              {/* Row 2: language + location */}
              <div className='grid gap-5 sm:grid-cols-2'>
                <div>
                  <label
                    htmlFor='brand-language'
                    className='mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase'
                  >
                    {t('field_language')}
                  </label>
                  <Select value={language} onValueChange={(v) => v && setLanguage(v as string)}>
                    <SelectTrigger id='brand-language' className='w-full'>
                      <SelectValue>
                        {language === 'pt_BR'
                          ? t('lang_pt_br')
                          : language === 'en_US'
                            ? t('lang_en_us')
                            : language === 'es_ES'
                              ? t('lang_es_es')
                              : language}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='pt_BR'>{t('lang_pt_br')}</SelectItem>
                      <SelectItem value='en_US'>{t('lang_en_us')}</SelectItem>
                      <SelectItem value='es_ES'>{t('lang_es_es')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label
                    htmlFor='brand-location'
                    className='mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase'
                  >
                    {t('field_location')}
                  </label>
                  <Input
                    id='brand-location'
                    type='text'
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t('placeholder_location')}
                  />
                </div>
              </div>

              {/* Row 3: persona */}
              <div>
                <label
                  htmlFor='brand-persona'
                  className='mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase'
                >
                  {t('field_persona')}
                </label>
                <Input
                  id='brand-persona'
                  type='text'
                  value={primary_persona}
                  onChange={(e) => setPrimaryPersona(e.target.value)}
                  placeholder={t('placeholder_persona')}
                />
              </div>

              {/* Row 4: tone */}
              <div>
                <label
                  htmlFor='brand-tone'
                  className='mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase'
                >
                  {t('field_tone')}
                </label>
                <Input
                  id='brand-tone'
                  type='text'
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder={t('placeholder_tone')}
                />
              </div>

              {/* Row 5: instructions (textarea) */}
              <div>
                <label
                  htmlFor='brand-instructions'
                  className='mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase'
                >
                  {t('field_ai_instructions')}
                </label>
                <textarea
                  id='brand-instructions'
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={4}
                  placeholder={t('placeholder_instructions')}
                  className='w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white'
                />
              </div>

              {/* Row 6: hashtags */}
              <div>
                <label
                  htmlFor='brand-hashtags'
                  className='mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase'
                >
                  {t('field_hashtags')}
                </label>
                <Input
                  id='brand-hashtags'
                  type='text'
                  value={hashtags_raw}
                  onChange={(e) => setHashtagsRaw(e.target.value)}
                  placeholder={t('placeholder_hashtags')}
                  className='font-mono'
                />
                <p className='mt-1 text-xs text-slate-400'>{t('field_hashtags_hint')}</p>
              </div>

              {/* Error message */}
              {errorMsg && (
                <p
                  role='alert'
                  className='rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400'
                >
                  {errorMsg}
                </p>
              )}

              {/* Footer: save button + saved indicator */}
              <div className='flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800'>
                <button
                  type='submit'
                  disabled={isSaving}
                  className='rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50'
                >
                  {isSaving ? t('saving') : t('save_changes')}
                </button>
                {saved && (
                  <span
                    data-testid='general-saved'
                    className='flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400'
                  >
                    <CheckCircle2 className='h-4 w-4' />
                    {t('saved')}
                  </span>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
