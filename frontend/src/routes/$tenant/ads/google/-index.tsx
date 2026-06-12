import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Plus,
  Funnel,
  CircleAlert,
  CircleCheck,
  FileBraces,
  X,
  LoaderCircle,
} from 'lucide-react'
import {
  getCampaigns,
  getLiveCampaigns,
  createCampaign,
} from '@/lib/api/campaigns'
import { normalizeCampaign } from '@/lib/utils/transforms'
import { withFallback } from '@/lib/utils/loader'
import { DataTable } from '@/components/ui/data-table'
import {
  CampaignNameCell,
  CampaignStatusBadge,
  CampaignActions,
  type UnifiedCampaign,
} from './-columns'
import { Route } from './index'

export function GoogleAdsRoute() {
  const { tenant } = Route.useParams()
  const { t } = useTranslation('ads')
  const { t: tg } = useTranslation('globals')

  const [combinedCampaigns, setCombinedCampaigns] = useState<UnifiedCampaign[]>(
    [],
  )
  const [isLoading, setIsLoading] = useState(true)

  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [importError, setImportError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [deployResult, setDeployResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const loadCampaigns = useCallback(async () => {
    const [local, live] = await Promise.all([
      withFallback(getCampaigns(tenant), []).then((raw) =>
        raw.map((c) => normalizeCampaign(c, tenant)),
      ),
      withFallback(getLiveCampaigns(tenant), []),
    ])

    const unifiedLocal = (local as unknown as UnifiedCampaign[]).map((c) => ({
      id: c.id,
      name: c.id,
      slug: c.slug,
      status: c.status,
      objective: c.objective,
      type: 'local' as const,
      tenant,
    }))

    const unifiedLive = (live as unknown as UnifiedCampaign[]).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      cost: c.cost,
      impressions: c.impressions,
      clicks: c.clicks,
      type: 'live' as const,
      tenant,
    }))

    return [...unifiedLive, ...unifiedLocal]
  }, [tenant])

  useEffect(() => {
    let active = true
    setIsLoading(true)
    loadCampaigns()
      .then((campaigns) => {
        if (active) setCombinedCampaigns(campaigns)
      })
      .catch((err) => {
        console.error('Failed to load campaigns:', err)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadCampaigns])

  async function importCampaign() {
    setImportError('')
    if (!jsonInput.trim()) {
      setImportError('JSON cannot be empty')
      return
    }

    let parsed: { result?: { id?: string; platform?: string } }
    try {
      parsed = JSON.parse(jsonInput)
    } catch {
      setImportError('Invalid JSON format')
      return
    }

    if (!parsed.result?.id || parsed.result?.platform !== 'google_search') {
      setImportError(
        'Missing result.id or result.platform must be "google_search"',
      )
      return
    }

    setIsImporting(true)
    try {
      const slug = parsed.result.id
      await createCampaign(tenant, { slug, data: parsed })
      setIsImportModalOpen(false)
      setJsonInput('')
      // Svelte did window.location.reload(); refetch in-place instead (SPA + testable).
      const campaigns = await loadCampaigns()
      setCombinedCampaigns(campaigns)
    } catch {
      setImportError('Failed to import campaign')
    } finally {
      setIsImporting(false)
    }
  }

  const columns = useMemo<ColumnDef<UnifiedCampaign>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: t('campaign_name'),
        cell: ({ row }) => (
          <CampaignNameCell
            name={row.original.name}
            id={row.original.id}
            slug={row.original.slug}
            type={row.original.type}
            objective={row.original.objective}
            tenant={row.original.tenant}
          />
        ),
      },
      {
        accessorKey: 'status',
        header: t('status'),
        cell: ({ row }) => (
          <CampaignStatusBadge
            status={row.original.status}
            type={row.original.type}
          />
        ),
      },
      {
        accessorKey: 'cost',
        header: 'Budget',
        cell: ({ row }) => row.original.cost ?? '-',
      },
      {
        accessorKey: 'impressions',
        header: t('labels.impressions'),
        cell: ({ row }) =>
          row.original.impressions !== undefined
            ? `${row.original.impressions} imp`
            : '-',
      },
      {
        accessorKey: 'clicks',
        header: t('labels.clicks'),
        cell: ({ row }) =>
          row.original.clicks !== undefined
            ? `${row.original.clicks} clicks`
            : '-',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => <CampaignActions campaign={row.original} />,
      },
    ],
    [t],
  )

  return (
    <div className="mx-auto w-full max-w-full px-4 py-8 sm:px-6 lg:w-[1200px] lg:px-8 xl:w-[1600px]">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 lg:text-3xl dark:text-white">
          {t('campaign_manager')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            {t('new_campaign')}
          </button>
        </div>
      </div>

      <DataTable
        data={combinedCampaigns}
        columns={columns}
        isLoading={isLoading}
        searchColumn="name"
        searchPlaceholder={t('search_campaigns_placeholder')}
        pageSize={50}
        previousLabel={tg('previous')}
        nextLabel={tg('next')}
        toolbar={
          <button
            type="button"
            className="rounded-md border border-slate-300 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <Funnel className="h-4 w-4" />
          </button>
        }
      />

      {deployResult && (
        <div
          onClick={() => setDeployResult(null)}
          className={`fixed right-6 bottom-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-5 py-4 text-sm font-medium shadow-xl ${
            deployResult.success
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {deployResult.success ? (
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          ) : (
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          )}
          <span>{deployResult.message}</span>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setIsImportModalOpen(false)}
          />
          <div className="relative z-100 flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                <FileBraces className="h-5 w-5 text-indigo-500" />
                {t('import_title')}
              </h3>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950/50">
              {importError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
                  {importError}
                </div>
              )}
              <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                {t('import_instructions')}{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
                  {t('import_platform_hint')}
                </code>
                .
              </p>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="h-72 w-full rounded-md border border-slate-300 bg-white p-4 font-mono text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                placeholder={`{\n  "workflow": { "reasoning": "..." },\n  "result": {\n    "id": "YYYY-MM-DD_slug",\n    "platform": "google_search",\n    "status": "draft",\n    ...\n  }\n}`}
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={importCampaign}
                disabled={isImporting}
                className="flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />{' '}
                    {t('importing')}
                  </>
                ) : (
                  <>
                    <FileBraces className="h-4 w-4" /> {t('import_submit')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
