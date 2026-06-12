import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { requirePlatformAdmin } from '@/lib/utils/platform-access'
import { SettingsLayout } from './-route'

export const Route = createFileRoute('/settings')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
    requirePlatformAdmin()
  },
  component: SettingsLayout,
})
