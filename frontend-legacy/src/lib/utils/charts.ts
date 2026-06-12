import type { ChartConfiguration } from 'chart.js'
import type { HistoryEntry, DbHistoryDay } from '$lib/api/campaigns'
import { m } from '$lib/paraglide/messages'

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function createPerformanceTimelineConfig(history: HistoryEntry[]): ChartConfiguration {
	return {
		type: 'line',
		data: {
			labels: history.map((h) => h.date),
			datasets: [
				{
					label: 'Clicks',
					data: history.map((h) => h.clicks),
					borderColor: '#3b82f6',
					backgroundColor: 'rgba(59,130,246,0.1)',
					yAxisID: 'y',
					tension: 0.4,
					fill: true
				},
				{
					label: m['ads:impressions'](),
					data: history.map((h) => h.impressions),
					borderColor: '#8b5cf6',
					backgroundColor: 'transparent',
					yAxisID: 'y1',
					tension: 0.4,
					borderDash: [5, 5]
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: {
				y: { type: 'linear', position: 'left', title: { display: true, text: 'Clicks' } },
				y1: {
					type: 'linear',
					position: 'right',
					grid: { drawOnChartArea: false },
					title: { display: true, text: 'Impressions' }
				}
			}
		}
	}
}

export function createDayOfWeekCostConfig(avgCosts: number[]): ChartConfiguration {
	return {
		type: 'bar',
		data: {
			labels: DOW_LABELS,
			datasets: [
				{
					label: m['ads:chart_avg_cost'](),
					data: avgCosts,
					backgroundColor: 'rgba(99,102,241,0.6)',
					borderColor: '#6366f1',
					borderWidth: 1
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				tooltip: {
					callbacks: {
						label: (ctx) => `R$${Number(ctx.raw).toFixed(2)}`
					}
				}
			},
			scales: {
				y: { beginAtZero: true, title: { display: true, text: m['ads:chart_cost']() } }
			}
		}
	}
}

export function createDayOfWeekCpaConfig(avgCpas: (number | null)[]): ChartConfiguration {
	return {
		type: 'bar',
		data: {
			labels: DOW_LABELS,
			datasets: [
				{
					label: m['ads:chart_avg_cpa'](),
					data: avgCpas,
					backgroundColor: 'rgba(245,158,11,0.6)',
					borderColor: '#f59e0b',
					borderWidth: 1
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				tooltip: {
					callbacks: {
						label: (ctx) => (ctx.raw != null ? `R$${Number(ctx.raw).toFixed(2)}` : '')
					}
				}
			},
			scales: {
				y: { beginAtZero: true, title: { display: true, text: m['ads:chart_cpa']() } }
			}
		}
	}
}

export function createDailyCostCpaConfig(history: DbHistoryDay[]): ChartConfiguration {
	return {
		type: 'bar',
		data: {
			labels: history.map((d) => d.date.substring(5)),
			datasets: [
				{
					type: 'bar',
					label: m['ads:chart_cost'](),
					data: history.map((d) => d.cost),
					backgroundColor: 'rgba(99,102,241,0.6)',
					borderColor: '#6366f1',
					borderWidth: 1,
					yAxisID: 'yCost'
				},
				{
					type: 'line',
					label: m['ads:chart_cpa'](),
					data: history.map((d) => (d.conversions > 0 ? d.cpa : null)),
					borderColor: '#f59e0b',
					backgroundColor: 'transparent',
					pointBackgroundColor: '#f59e0b',
					pointRadius: 4,
					tension: 0.3,
					yAxisID: 'yCpa',
					spanGaps: false
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			plugins: {
				tooltip: {
					callbacks: {
						label: (ctx) => {
							if (ctx.datasetIndex === 0) return `Cost: R$${Number(ctx.raw).toFixed(2)}`
							if (ctx.datasetIndex === 1 && ctx.raw != null)
								return `CPA: R$${Number(ctx.raw).toFixed(2)}`
							return ''
						}
					}
				}
			},
			scales: {
				yCost: {
					type: 'linear',
					position: 'left',
					title: { display: true, text: m['ads:chart_cost']() },
					beginAtZero: true
				},
				yCpa: {
					type: 'linear',
					position: 'right',
					title: { display: true, text: m['ads:chart_cpa']() },
					grid: { drawOnChartArea: false },
					beginAtZero: true
				}
			}
		}
	}
}
