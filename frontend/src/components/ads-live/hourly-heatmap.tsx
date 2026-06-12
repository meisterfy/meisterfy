import { useMemo } from 'react'
import { Chart } from 'react-chartjs-2'
import type { ChartConfiguration, ChartData, ChartOptions } from 'chart.js'
import { useTranslation } from 'react-i18next'
import type { HourlyRow } from '@/lib/api/campaigns'
import '@/lib/utils/chart-setup'

function top3Indices(rows: HourlyRow[]) {
  return [...rows]
    .map((r, i) => ({ i, v: r.conversions }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 3)
    .map((x) => x.i)
}

export function HourlyHeatmap({ hourly }: { hourly: HourlyRow[] }) {
  const { t } = useTranslation('ads')

  const hasConversions = hourly.some((h) => h.conversions > 0)

  // Mixed bar+line: typed as the default ChartConfiguration (the union allows a
  // per-dataset `type: 'line'`); narrowed to <'bar'> at the <Chart> render.
  const chartConfig = useMemo<ChartConfiguration>(() => {
    const top3 = top3Indices(hourly)
    return {
      type: 'bar',
      data: {
        labels: hourly.map((h) => `${h.hour}h`),
        datasets: [
          {
            label: t('analytics.hourly_conversions'),
            data: hourly.map((h) => h.conversions),
            backgroundColor: hourly.map((_, i) => (top3.includes(i) ? '#10b981' : '#6366f1')),
            yAxisID: 'y',
            order: 2,
          },
          {
            label: t('analytics.hourly_cost'),
            data: hourly.map((h) => h.cost),
            type: 'line' as const,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            pointRadius: 0,
            borderWidth: 1.5,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: t('analytics.hourly_conversions') },
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: t('analytics.hourly_cost') },
            grid: { drawOnChartArea: false },
          },
        },
      },
    }
  }, [hourly, t])

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('analytics.hourly_title')}
        </h3>
        <p className="mt-0.5 text-xs text-slate-400">{t('analytics.hourly_subtitle')}</p>
      </div>

      {!hasConversions ? (
        <p className="py-8 text-center text-sm text-slate-400">{t('analytics.hourly_empty')}</p>
      ) : (
        <div className="h-[260px]">
          <Chart
            type="bar"
            data={chartConfig.data as ChartData<'bar'>}
            options={chartConfig.options as ChartOptions<'bar'>}
          />
        </div>
      )}
    </div>
  )
}
