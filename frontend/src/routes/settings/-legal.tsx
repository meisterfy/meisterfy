import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ScrollText, Trash2 } from 'lucide-react'
import {
  getLegalVersions,
  createLegalVersion,
  updateLegalVersion,
} from '@/lib/api/legal'
import type { LegalVersion, LegalBlock } from '@/lib/api/legal'
import { qk, fallbackQuery } from '@/lib/query'
import { SectionTitle } from '@/components/section-title'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const LOCALES = ['en', 'pt-BR']

function emptyTranslations(): Record<string, LegalBlock[]> {
  return {
    en: [{ title: '', content: '' }],
    'pt-BR': [{ title: '', content: '' }],
  }
}

export function LegalRoute() {
  const { t } = useTranslation('settings')
  const { t: tGlobals } = useTranslation('globals')
  const queryClient = useQueryClient()

  const { data: queryData, isLoading } = useQuery({
    queryKey: qk.legalVersions,
    queryFn: () => fallbackQuery(() => getLegalVersions(), []),
  })

  // Local editable copy seeded from query data
  const [versions, setVersions] = useState<LegalVersion[]>([])
  useEffect(() => {
    if (queryData) {
      setVersions(queryData)
    }
  }, [queryData])

  // Selection state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)

  // Editor state
  const [editFallbackLocale, setEditFallbackLocale] = useState('pt-BR')
  const [editEffectiveAt, setEditEffectiveAt] = useState('')
  const [editLocale, setEditLocale] = useState('en')
  const [editTranslations, setEditTranslations] =
    useState<Record<string, LegalBlock[]>>(emptyTranslations())
  const [saving, setSaving] = useState(false)

  function newEmptyVersion(): void {
    setIsNew(true)
    setSelectedId(null)
    setEditFallbackLocale('pt-BR')
    setEditEffectiveAt(new Date().toISOString().slice(0, 10))
    setEditLocale('en')
    setEditTranslations(emptyTranslations())
  }

  function selectVersion(v: LegalVersion): void {
    setIsNew(false)
    setSelectedId(v.id)
    setEditFallbackLocale(v.fallback_locale)
    setEditEffectiveAt(v.effective_at.slice(0, 10))
    setEditLocale('en')
    // deep-clone so edits don't mutate the list
    const cloned: Record<string, LegalBlock[]> = {}
    for (const [locale, blocks] of Object.entries(v.translations)) {
      cloned[locale] = blocks.map((b) => ({ ...b }))
    }
    // ensure both locales exist
    for (const loc of LOCALES) {
      if (!cloned[loc]) cloned[loc] = [{ title: '', content: '' }]
    }
    setEditTranslations(cloned)
  }

  function currentBlocks(): LegalBlock[] {
    return editTranslations[editLocale] ?? []
  }

  function addBlock(): void {
    setEditTranslations((prev) => ({
      ...prev,
      [editLocale]: [...(prev[editLocale] ?? []), { title: '', content: '' }],
    }))
  }

  function removeBlock(idx: number): void {
    setEditTranslations((prev) => ({
      ...prev,
      [editLocale]: (prev[editLocale] ?? []).filter((_, i) => i !== idx),
    }))
  }

  function updateBlock(
    idx: number,
    field: 'title' | 'content',
    value: string,
  ): void {
    setEditTranslations((prev) => ({
      ...prev,
      [editLocale]: (prev[editLocale] ?? []).map((b, i) =>
        i === idx ? { ...b, [field]: value } : b,
      ),
    }))
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    try {
      const body = {
        fallback_locale: editFallbackLocale,
        translations: editTranslations,
        effective_at: editEffectiveAt
          ? new Date(editEffectiveAt).toISOString()
          : new Date().toISOString(),
      }
      if (isNew) {
        const created = await createLegalVersion(body)
        setVersions((prev) => [created, ...prev])
        setSelectedId(created.id)
        setIsNew(false)
        void queryClient.invalidateQueries({ queryKey: qk.legalVersions })
        toast.success(t('legal_toast_created'))
      } else {
        await updateLegalVersion(selectedId!, body)
        setVersions((prev) =>
          prev.map((v) =>
            v.id === selectedId
              ? {
                  ...v,
                  fallback_locale: body.fallback_locale,
                  translations: body.translations,
                  effective_at: body.effective_at,
                }
              : v,
          ),
        )
        void queryClient.invalidateQueries({ queryKey: qk.legalVersions })
        toast.success(t('legal_toast_saved'))
      }
    } catch {
      toast.error(tGlobals('error_generic'))
    } finally {
      setSaving(false)
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString()
  }

  const showEditor = selectedId !== null || isNew

  return (
    <div className="flex flex-1 gap-0 overflow-hidden" data-testid="legal-page">
      {/* Left panel: version list */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {t('legal_title')}
          </span>
          <button
            type="button"
            onClick={newEmptyVersion}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title={t('legal_new_version')}
            data-testid="new-version-btn"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : versions.length === 0 && !isNew ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t('legal_no_versions')}
            </p>
          ) : null}

          {isNew && (
            <button
              type="button"
              className="w-full border-b border-slate-200 bg-primary/10 px-4 py-3 text-left dark:border-slate-800 dark:bg-primary/20"
              data-testid="new-version-row"
            >
              <p className="text-sm font-medium text-primary">
                {t('legal_new_version')}
              </p>
            </button>
          )}

          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => selectVersion(v)}
              data-testid={`version-row-${v.id}`}
              className={`w-full border-b border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 ${
                selectedId === v.id && !isNew
                  ? 'bg-muted dark:bg-slate-800'
                  : ''
              }`}
            >
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {t('legal_version_label', { version: v.version })}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('legal_effective_label', {
                  date: formatDate(v.effective_at),
                })}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* Right panel: editor */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        {!showEditor ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <ScrollText className="h-10 w-10" />
            <p className="text-sm">{t('legal_no_versions')}</p>
            <Button onClick={newEmptyVersion} className="mt-2 h-9 px-4 text-sm">
              {t('legal_new_version')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 p-6">
            <SectionTitle
              title={isNew ? t('legal_new_version') : t('legal_title')}
              icon={<ScrollText className="text-muted-foreground h-5 w-5" />}
            >
              <Button
                onClick={handleSave}
                disabled={saving}
                data-testid="save-btn"
              >
                {saving ? '…' : isNew ? t('legal_create') : tGlobals('save')}
              </Button>
            </SectionTitle>

            {/* Meta fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="effective-at"
                  className="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
                >
                  {t('legal_field_effective_at')}
                </label>
                <Input
                  id="effective-at"
                  type="date"
                  value={editEffectiveAt}
                  onChange={(e) => setEditEffectiveAt(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="fallback-locale"
                  className="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
                >
                  {t('legal_field_fallback_locale')}
                </label>
                <Select
                  value={editFallbackLocale}
                  onValueChange={(val) => setEditFallbackLocale(val as string)}
                >
                  <SelectTrigger id="fallback-locale" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALES.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Locale tabs */}
            <div>
              <Tabs
                value={editLocale}
                onValueChange={(val) => setEditLocale(val as string)}
                data-testid="locale-tabs"
              >
                <TabsList>
                  {LOCALES.map((loc) => (
                    <TabsTrigger
                      key={loc}
                      value={loc}
                      data-testid={`tab-${loc}`}
                    >
                      {loc}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* Blocks for the active locale */}
              <div className="mt-4 flex flex-col gap-4">
                {currentBlocks().map((block, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border bg-white p-4 dark:bg-slate-900"
                    data-testid={`block-${idx}`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {t('legal_block_title')}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBlock(idx)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title={t('legal_remove_block')}
                        data-testid={`remove-block-${idx}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <Input
                      className="mb-3"
                      placeholder={t('legal_block_title')}
                      value={block.title}
                      onChange={(e) =>
                        updateBlock(idx, 'title', e.target.value)
                      }
                      data-testid={`block-title-${idx}`}
                    />
                    <textarea
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
                      rows={6}
                      placeholder={t('legal_block_content')}
                      value={block.content}
                      onChange={(e) =>
                        updateBlock(idx, 'content', e.target.value)
                      }
                      data-testid={`block-content-${idx}`}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addBlock}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  data-testid="add-block-btn"
                >
                  <Plus className="h-4 w-4" />
                  {t('legal_add_block')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
