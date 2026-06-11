import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { SocialPlannerRoute } from './-index'

export const Route = createFileRoute('/$tenant/social/')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: SocialPlannerRoute,
})
