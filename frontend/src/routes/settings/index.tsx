import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/')({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw redirect({ to: '/settings/integrations' } as any)
  },
  component: () => null,
})
