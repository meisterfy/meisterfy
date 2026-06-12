import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { GoogleAdsRoute } from './-index'

export const Route = createFileRoute('/$tenant/ads/google/')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: GoogleAdsRoute,
})
