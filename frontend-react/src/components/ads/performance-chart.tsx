import { Chart } from 'react-chartjs-2'
import type { ChartConfiguration, ChartType } from 'chart.js'
import type { LucideIcon } from 'lucide-react'
import '@/lib/utils/chart-setup'

// Faithful port of performance-chart.svelte: a titled card wrapping a chart.js
// chart built from a generic ChartConfiguration. The Svelte managed a canvas +
// `new Chart()`; react-chartjs-2's <Chart> handles the lifecycle.
export function PerformanceChart({
  config,
  title,
  source,
  note,
  icon: Icon,
}: {
  config: ChartConfiguration
  title?: string
  source?: string
  note?: string
  icon?: LucideIcon
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {title && (
        <h3
          className={`flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white ${
            note ? 'mb-1' : 'mb-6'
          }`}
        >
          {Icon && <Icon className="h-5 w-5 text-indigo-500" />}
          {title}
          {source && <span className="ml-auto text-xs font-normal text-slate-400">{source}</span>}
        </h3>
      )}
      {note && <p className="mb-5 ml-7 text-xs text-slate-400">{note}</p>}
      <div className="h-[280px] w-full">
        <Chart type={config.type as ChartType} data={config.data} options={config.options} />
      </div>
    </div>
  )
}
