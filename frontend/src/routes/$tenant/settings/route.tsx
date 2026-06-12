import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { TenantSettingsLayout } from './-route'

export const Route = createFileRoute('/$tenant/settings')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: TenantSettingsLayout,
})
