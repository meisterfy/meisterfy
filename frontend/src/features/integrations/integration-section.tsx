import * as React from 'react'

interface IntegrationSectionProps {
  title: string
  description?: string
  children: React.ReactNode
}

function IntegrationSection({ title, description, children }: IntegrationSectionProps) {
  return (
    <section className="mb-12">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-slate-500">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
    </section>
  )
}

export { IntegrationSection }
