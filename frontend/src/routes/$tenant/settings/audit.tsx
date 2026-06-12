import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { AuditRoute } from './-audit'

export const Route = createFileRoute('/$tenant/settings/audit')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuditRoute,
})
