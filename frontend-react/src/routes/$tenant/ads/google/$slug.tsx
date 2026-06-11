import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { CampaignDetailRoute } from './-slug'

export const Route = createFileRoute('/$tenant/ads/google/$slug')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: CampaignDetailRoute,
})
