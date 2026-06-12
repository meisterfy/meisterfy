import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { GoogleAdsRoute } from './-google-ads'

export const Route = createFileRoute('/$tenant/settings/google-ads')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: GoogleAdsRoute,
})
