import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/store/auth'
import { Button } from '@/components/ui/button'
import type { PendingTerms } from '@/store/auth'

interface TermsWallProps {
  terms: PendingTerms
}

export function TermsWall({ terms }: TermsWallProps) {
  const { t } = useTranslation('globals')
  const navigate = useNavigate()
  const acceptTerms = useAuth((s) => s.acceptTerms)
  const clear = useAuth((s) => s.clear)

  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleAccept() {
    if (!agreed || loading) return
    setLoading(true)
    try {
      await acceptTerms(terms.version_id)
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    clear()
    navigate({ to: '/login' })
  }

  return (
    <div className='fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950'>
      <header className='border-b border-slate-200 px-6 py-4 dark:border-slate-800'>
        <h1 className='text-xl font-bold text-slate-900 dark:text-white'>
          {t('terms:update_title')}
        </h1>
      </header>

      <div className='flex-1 overflow-y-auto px-6 py-6'>
        <div className='mx-auto max-w-3xl space-y-8'>
          {terms.blocks.map((block) => (
            <section key={block.title}>
              <h2 className='mb-3 text-lg font-semibold text-slate-900 dark:text-white'>
                {block.title}
              </h2>
              <p className='whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-400'>
                {block.content}
              </p>
            </section>
          ))}
        </div>
      </div>

      <footer className='border-t border-slate-200 px-6 py-4 dark:border-slate-800'>
        <div className='mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <label className='flex cursor-pointer items-center gap-3'>
            <input
              type='checkbox'
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className='h-4 w-4 rounded border-slate-300 accent-indigo-600'
            />
            <span className='text-sm text-slate-700 dark:text-slate-300'>
              {t('terms:agree_checkbox')}
            </span>
          </label>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={handleLogout}
              className='text-sm text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            >
              {t('terms:logout')}
            </button>
            <Button onClick={handleAccept} disabled={!agreed || loading}>
              {t('terms:continue')}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
