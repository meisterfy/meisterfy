import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { RolesRoute } from './-roles'

export const Route = createFileRoute('/$tenant/settings/roles')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: RolesRoute,
})
