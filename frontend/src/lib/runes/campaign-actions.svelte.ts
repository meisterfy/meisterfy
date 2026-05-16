import { syncHistory } from '$lib/api/campaigns'
import { getToken } from '$lib/api/client'

export function createCampaignActions() {
	let syncing = $state(false)
	let exporting = $state(false)

	async function runSyncHistory(tenantId: string) {
		if (syncing) return
		syncing = true
		try {
			const res = await syncHistory(tenantId)
			alert(`Synced ${res.rows} rows (${res.from} -> ${res.to})`)
		} catch {
			alert('Sync failed! Check Google Ads integration')
		} finally {
			syncing = false
		}
	}

	async function exportReport(campaignId: string, clientId: string) {
		if (exporting) return
		exporting = true
		try {
			const token = getToken()
			const res = await fetch(`/api/reports/campaign/${campaignId}?client_id=${clientId}`, {
				headers: { Authorization: `Bearer ${token}` }
			})
			if (res.ok) {
				const blob = await res.blob()
				const url = window.URL.createObjectURL(blob)
				const a = document.createElement('a')
				a.href = url
				// not reactive state — Date is used inline to format a filename string
				// eslint-disable-next-line svelte/prefer-svelte-reactivity
				a.download = `report-${campaignId}-${new Date().toISOString().split('T')[0]}.pdf`
				document.body.appendChild(a)
				a.click()
				document.body.removeChild(a)
			} else {
				alert('Failed to generate report')
			}
		} catch {
			alert('Error exporting report')
		} finally {
			exporting = false
		}
	}

	return {
		get syncing() {
			return syncing
		},
		get exporting() {
			return exporting
		},
		runSyncHistory,
		exportReport
	}
}
