import { useMemo } from 'react'
import { Doughnut } from 'react-chartjs-2'
import type { ChartConfiguration } from 'chart.js'
import { useTranslation } from 'react-i18next'
import type { DeviceRow } from '@/lib/api/campaigns'
import '@/lib/utils/chart-setup'

const DEVICE_COLORS: Record<string, string> = {
  DESKTOP: '#3b82f6',
  MOBILE: '#22c55e',
  TABLET: '#f59e0b',
}

export function DeviceBreakdown({ devices }: { devices: DeviceRow[] }) {
  const { t } = useTranslation('ads')

  const deviceLabel = (d: string) =>
    d === 'DESKTOP'
      ? t('analytics.device_desktop')
      : d === 'MOBILE'
        ? t('analytics.device_mobile')
        : t('analytics.device_tablet')

  const donutConfig = useMemo<ChartConfiguration<'doughnut'>>(
    () => ({
      type: 'doughnut',
      data: {
        labels: devices.map((d) => deviceLabel(d.device)),
        datasets: [
          {
            data: devices.map((d) => d.cost),
            backgroundColor: devices.map((d) => DEVICE_COLORS[d.device] ?? '#94a3b8'),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => ` R$${ctx.parsed.toFixed(2)}`,
            },
          },
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devices, t],
  )

  const cpaDevices = useMemo(
    () => devices.filter((d) => d.conversions > 0).sort((a, b) => a.cpa - b.cpa),
    [devices],
  )

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('analytics.device_title')}
        </h3>
        <p className="mt-0.5 text-xs text-slate-400">{t('analytics.device_subtitle')}</p>
      </div>

      {devices.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">{t('analytics.device_empty')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
              {t('analytics.device_cost_share')}
            </p>
            <div className="h-[220px]">
              <Doughnut data={donutConfig.data} options={donutConfig.options} />
            </div>
          </div>

          {cpaDevices.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                {t('analytics.device_cpa_chart')}
              </p>
              <div className="space-y-3">
                {cpaDevices.map((d) => {
                  const maxCpa = cpaDevices[cpaDevices.length - 1].cpa
                  return (
                    <div key={d.device} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>{deviceLabel(d.device)}</span>
                        <span className="font-semibold">R${d.cpa.toFixed(2)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${maxCpa > 0 ? ((d.cpa / maxCpa) * 100).toFixed(1) : 0}%`,
                            background: DEVICE_COLORS[d.device] ?? '#94a3b8',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
