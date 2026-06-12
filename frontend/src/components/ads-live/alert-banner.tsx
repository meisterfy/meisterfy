import { TriangleAlert, OctagonAlert } from 'lucide-react'

interface Alert {
  id: string
  level: string
  type: string
  message: string
  action_suggested?: string
}

export function AlertBanner({ data }: { data: { openAlerts: Alert[] } }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
      {data.openAlerts.map((alert) => (
        <div key={alert.id} className="flex items-start gap-3">
          {alert.level === 'CRITICAL' ? (
            <OctagonAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          ) : (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          )}
          <div>
            <span className="mr-2 text-xs font-bold tracking-wide text-red-700 uppercase dark:text-red-300">
              {alert.level}
            </span>
            <span className="text-sm text-red-800 dark:text-red-200">
              {alert.message}
            </span>
            {alert.action_suggested && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                {alert.action_suggested}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
