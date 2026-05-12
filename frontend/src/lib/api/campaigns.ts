import { apiFetch, apiFetchData } from './client'

export interface LiveCampaign {
	id: string
	name: string
	status: string
	impressions: string
	clicks: string
	cost: string
}

export interface CampaignListItem {
	id: string
	tenant_id: string
	slug: string
}

export interface Campaign extends CampaignListItem {
	data: Record<string, string | number | boolean | null | object>
}

export const getCampaigns = (tenantId: string, fetchFn?: typeof fetch) =>
	apiFetchData<Campaign[]>(`/admin/tenants/${tenantId}/campaigns`, {}, fetchFn)

export const getCampaign = (tenantId: string, slug: string) =>
	apiFetchData<Campaign>(`/admin/tenants/${tenantId}/campaigns/${slug}`)

export const createCampaign = (tenantId: string, body: { slug: string; data: Record<string, string | number | boolean | null | object> }) =>
	apiFetchData<Campaign>(`/admin/tenants/${tenantId}/campaigns`, {
		method: 'POST',
		body: JSON.stringify(body)
	})

export const deleteCampaign = (tenantId: string, id: string) =>
	apiFetch<void>(`/admin/tenants/${tenantId}/campaigns/${id}`, { method: 'DELETE' })

export const updateCampaign = (tenantId: string, slug: string, data: Record<string, string | number | boolean | null | object>) =>
	apiFetchData<Campaign>(`/admin/tenants/${tenantId}/campaigns/${slug}`, {
		method: 'PUT',
		body: JSON.stringify({ data })
	})

export const deployCampaign = (tenantId: string, id: string) =>
	apiFetch<void>(`/admin/tenants/${tenantId}/campaigns/${id}/deploy`, { method: 'POST' })

export const getLiveCampaigns = (tenantId: string, fetchFn?: typeof fetch) =>
	apiFetchData<LiveCampaign[]>(`/admin/tenants/${tenantId}/campaigns/live`, {}, fetchFn)

export interface AdGroupMetrics {
	impressions: number
	clicks: number
	cost: string
	conversions: number
}

export interface AdGroup {
	id: string
	name: string
	status: string
	metrics: AdGroupMetrics
}

export interface CampaignMetrics {
	impressions: string
	clicks: string
	cost: string
	conversions: string
	cpa: string
	searchImpressionShare: string
}

export interface HistoryEntry {
	date: string
	clicks: number
	impressions: number
}

export interface LiveCampaignDetail {
	campaign: {
		id: string
		name: string
		status: string
		strategy: string
		budgetMicros: number
		metrics: CampaignMetrics
		history: HistoryEntry[]
		adGroups: AdGroup[]
	}
	wow: {
		cur: { impressions: number; clicks: number; cost: number; conversions: number }
		prev: { impressions: number; clicks: number; cost: number; conversions: number }
	}
	budgetPacing: { date: string; cost: number; budget: number; pct: number } | null
	client: { id: string }
	openAlerts: Array<{ id: string; level: string; type: string; message: string }>
}

export interface DbHistoryDay {
	date: string
	campaign_id: string
	cost: number
	conversions: number
	clicks: number
	impressions: number
	cpa: number
	budgetMicros?: number
}

export const getLiveCampaignDetail = (
	tenantId: string,
	campaignId: string,
	params: { startDate?: string; endDate?: string },
	fetchFn?: typeof fetch
) => {
	const qs = new URLSearchParams()
	if (params.startDate) qs.set('startDate', params.startDate)
	if (params.endDate) qs.set('endDate', params.endDate)
	const query = qs.toString() ? `?${qs.toString()}` : ''
	return apiFetchData<LiveCampaignDetail>(
		`/admin/tenants/${tenantId}/campaigns/live/${campaignId}${query}`,
		{},
		fetchFn
	)
}

export const syncHistory = (tenantId: string) =>
	apiFetchData<{ from: string; to: string; rows: number }>(
		`/admin/tenants/${tenantId}/campaigns/sync-history`,
		{ method: 'POST' }
	)

export const getDbMetrics = (tenantId: string, days: number, campaignId: string, fetchFn?: typeof fetch) =>
	apiFetchData<DbHistoryDay[]>(
		`/admin/tenants/${tenantId}/metrics?days=${days}&campaign_id=${campaignId}`,
		{},
		fetchFn
	)

export interface DeviceRow {
  device: string
  cost: number
  conversions: number
  clicks: number
  impressions: number
  cpa: number
  ctr: number
}

export interface HourlyRow {
  hour: number
  cost: number
  conversions: number
  clicks: number
  impressions: number
}

export interface ImpressionShareStats {
  wonShare: number
  lostBudget: number
  lostRank: number
}

export const getDeviceBreakdown = (
  tenantId: string,
  campaignId: string,
  params: { startDate?: string; endDate?: string },
  fetchFn?: typeof fetch
) => {
  const qs = new URLSearchParams()
  if (params.startDate) qs.set('startDate', params.startDate)
  if (params.endDate) qs.set('endDate', params.endDate)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetchData<DeviceRow[]>(
    `/admin/tenants/${tenantId}/campaigns/live/${campaignId}/devices${query}`,
    {},
    fetchFn
  )
}

export const getHourlyBreakdown = (
  tenantId: string,
  campaignId: string,
  params: { startDate?: string; endDate?: string },
  fetchFn?: typeof fetch
) => {
  const qs = new URLSearchParams()
  if (params.startDate) qs.set('startDate', params.startDate)
  if (params.endDate) qs.set('endDate', params.endDate)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetchData<HourlyRow[]>(
    `/admin/tenants/${tenantId}/campaigns/live/${campaignId}/hourly${query}`,
    {},
    fetchFn
  )
}

export const getImpressionShare = (
  tenantId: string,
  campaignId: string,
  params: { startDate?: string; endDate?: string },
  fetchFn?: typeof fetch
) => {
  const qs = new URLSearchParams()
  if (params.startDate) qs.set('startDate', params.startDate)
  if (params.endDate) qs.set('endDate', params.endDate)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetchData<ImpressionShareStats | null>(
    `/admin/tenants/${tenantId}/campaigns/live/${campaignId}/impression-share${query}`,
    {},
    fetchFn
  )
}

export const isSmartManaged = (adGroups: AdGroup[]) =>
	adGroups.length === 1 &&
	adGroups[0].name.includes('Smart Campaign Managed AdGroup') &&
	adGroups[0].metrics.impressions === 0

export interface SearchTermRow {
  term: string
  status: string
  clicks: number
  impressions: number
  cost: number
  conversions: number
  cpa: number
  ctr: number
}

export interface KeywordQSRow {
  keywordText: string
  matchType: string
  adGroupName: string
  qualityScore: number
  creativeQS: string
  postClickQS: string
  predictedCTR: string
}

export interface KeywordPerfRow {
  keywordText: string
  matchType: string
  adGroupName: string
  clicks: number
  impressions: number
  cost: number
  conversions: number
  cpa: number
  ctr: number
}

export const getSearchTerms = (
  tenantId: string,
  campaignId: string,
  params: { startDate?: string; endDate?: string },
  fetchFn?: typeof fetch
) => {
  const qs = new URLSearchParams()
  if (params.startDate) qs.set('startDate', params.startDate)
  if (params.endDate) qs.set('endDate', params.endDate)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetchData<SearchTermRow[]>(
    `/admin/tenants/${tenantId}/campaigns/live/${campaignId}/search-terms${query}`,
    {},
    fetchFn
  )
}

export const getKeywordQualityScores = (
  tenantId: string,
  campaignId: string,
  fetchFn?: typeof fetch
) =>
  apiFetchData<KeywordQSRow[]>(
    `/admin/tenants/${tenantId}/campaigns/live/${campaignId}/quality-scores`,
    {},
    fetchFn
  )

export const getKeywordPerformance = (
  tenantId: string,
  campaignId: string,
  params: { startDate?: string; endDate?: string },
  fetchFn?: typeof fetch
) => {
  const qs = new URLSearchParams()
  if (params.startDate) qs.set('startDate', params.startDate)
  if (params.endDate) qs.set('endDate', params.endDate)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetchData<KeywordPerfRow[]>(
    `/admin/tenants/${tenantId}/campaigns/live/${campaignId}/keywords${query}`,
    {},
    fetchFn
  )
}
