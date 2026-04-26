import { apiFetch } from './client'

export interface AgentRun {
	id: string
	tenant_id: string | null
	agent: string
	status: 'running' | 'success' | 'error'
	started_at: string
	finished_at: string | null
	summary: string | null
	error: string | null
}

export interface ScheduleData {
	last_run: AgentRun | null
	runs: AgentRun[]
	cron_command: string
}

export const getSchedule = (tenantId: string) =>
	apiFetch<ScheduleData>(`/admin/tenants/${tenantId}/schedule`)
