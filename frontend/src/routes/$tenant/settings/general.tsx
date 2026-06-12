import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { GeneralSettingsRoute } from './-general'

export const Route = createFileRoute('/$tenant/settings/general')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: GeneralSettingsRoute,
})
