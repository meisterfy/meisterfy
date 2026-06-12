import { createFileRoute, redirect } from '@tanstack/react-router'
import { SetupRoute } from './-setup'

export const Route = createFileRoute('/setup')({
  beforeLoad: async () => {
    const res = await fetch('/health')
    const data = await res.json()
    if (!data.setup_required) {
      throw redirect({ to: '/login' })
    }
  },
  component: SetupRoute,
})
