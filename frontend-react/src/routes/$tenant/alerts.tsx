import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { AlertsRoute } from './-alerts'

export const Route = createFileRoute('/$tenant/alerts')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: AlertsRoute,
})
