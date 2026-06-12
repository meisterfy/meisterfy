import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { LiveCampaignRoute } from './-campaign_id'

export const Route = createFileRoute('/$tenant/ads/google/live/$campaign_id')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: LiveCampaignRoute,
})
