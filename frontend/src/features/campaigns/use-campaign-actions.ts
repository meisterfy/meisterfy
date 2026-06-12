import { useCallback, useRef, useState } from 'react'
import { syncHistory } from '@/lib/api/campaigns'
import { getToken } from '@/lib/api/client'
import { toast } from 'sonner'

export function useCampaignActions() {
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)

  const [exporting, setExporting] = useState(false)
  const exportingRef = useRef(false)

  const runSyncHistory = useCallback(async (tenantId: string) => {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    try {
      const res = await syncHistory(tenantId)
      toast.success(`Synced ${res.rows} rows`, { description: `${res.from} → ${res.to}` })
    } catch {
      toast.error('Sync failed', { description: 'Check Google Ads integration' })
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [])

  const exportReport = useCallback(async (campaignId: string, clientId: string) => {
    if (exportingRef.current) return
    exportingRef.current = true
    setExporting(true)
    try {
      const token = getToken()
      const res = await fetch(`/api/reports/campaign/${campaignId}?client_id=${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `report-${campaignId}-${new Date().toISOString().split('T')[0]}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } else {
        toast.error('Failed to generate report')
      }
    } catch {
      toast.error('Error exporting report')
    } finally {
      exportingRef.current = false
      setExporting(false)
    }
  }, [])

  return { syncing, exporting, runSyncHistory, exportReport }
}
