interface SettingsSkeletonProps {
  rows?: number
  twoPanel?: boolean
}

export function SettingsSkeleton({ rows = 5, twoPanel = false }: SettingsSkeletonProps) {
  const cols = rows > 3 ? 5 : 4

  return (
    <div className='flex animate-pulse flex-col gap-6 p-6'>
      {/* header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='h-5 w-5 rounded bg-slate-200 dark:bg-slate-700'></div>
          <div className='h-5 w-40 rounded bg-slate-200 dark:bg-slate-700'></div>
        </div>
        <div className='h-9 w-28 rounded-md bg-slate-200 dark:bg-slate-700'></div>
      </div>

      {twoPanel ? (
        /* two-panel: roles layout */
        <div className='grid gap-6 lg:grid-cols-[260px_1fr]'>
          <div className='flex flex-col gap-2'>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className='h-12 w-full rounded-lg bg-slate-100 dark:bg-slate-800'></div>
            ))}
          </div>
          <div className='rounded-xl border border-slate-200 dark:border-slate-800'>
            <div className='border-b border-slate-200 px-5 py-4 dark:border-slate-800'>
              <div className='h-5 w-32 rounded bg-slate-200 dark:bg-slate-700'></div>
            </div>
            <div className='grid gap-4 p-5 sm:grid-cols-2'>
              {Array.from({ length: 6 }, (_, j) => (
                <div key={j} className='flex flex-col gap-2'>
                  <div className='h-3 w-24 rounded bg-slate-100 dark:bg-slate-800'></div>
                  {Array.from({ length: 4 }, (_, k) => (
                    <div
                      key={k}
                      className='h-5 w-full rounded bg-slate-100 dark:bg-slate-800'
                    ></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* table layout: users / audit */
        <div className='overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800'>
          <div
            className='grid border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/50'
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: cols }, (_, i) => (
              <div key={i} className='h-3.5 w-20 rounded bg-slate-200 dark:bg-slate-700'></div>
            ))}
          </div>
          {Array.from({ length: rows }, (_, j) => (
            <div
              key={j}
              className='grid items-center border-t border-slate-200 px-4 py-3 dark:border-slate-800'
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
            >
              {Array.from({ length: cols }, (_, k) => (
                <div key={k} className='h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-800'></div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
