import { describe, it, expect } from 'vitest'
import type { HistoryEntry, DbHistoryDay } from '@/lib/api/campaigns'
import {
  createPerformanceTimelineConfig,
  createDailyCostCpaConfig,
  createDayOfWeekCostConfig,
  createDayOfWeekCpaConfig,
} from './charts'

const t = (key: string) => key

describe('chart config builders', () => {
  it('builds a dual-axis performance timeline line chart', () => {
    const history = [
      { date: '2026-01-01', clicks: 5, impressions: 100 },
      { date: '2026-01-02', clicks: 8, impressions: 140 },
    ] as unknown as HistoryEntry[]
    const cfg = createPerformanceTimelineConfig(history, t)
    expect(cfg.type).toBe('line')
    expect(cfg.data.labels).toEqual(['2026-01-01', '2026-01-02'])
    expect(cfg.data.datasets[0].label).toBe('Clicks')
    expect(cfg.data.datasets[1].label).toBe('impressions')
  })

  it('builds a mixed bar+line daily cost/CPA chart, nulling CPA on zero-conversion days', () => {
    const history = [
      { date: '2026-01-01', cost: 10, cpa: 5, conversions: 2 },
      { date: '2026-01-02', cost: 12, cpa: 0, conversions: 0 },
    ] as unknown as DbHistoryDay[]
    const cfg = createDailyCostCpaConfig(history, t)
    expect(cfg.data.datasets[0].data).toEqual([10, 12])
    expect(cfg.data.datasets[1].data).toEqual([5, null])
    expect(cfg.data.labels).toEqual(['01-01', '01-02'])
  })

  it('builds day-of-week bar charts with 7 labels', () => {
    expect(createDayOfWeekCostConfig([1, 2, 3, 4, 5, 6, 7], t).data.labels).toHaveLength(7)
    expect(createDayOfWeekCpaConfig([1, 2, 3, 4, 5, 6, null], t).type).toBe('bar')
  })
})
