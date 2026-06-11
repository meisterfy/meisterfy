import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { DraftsRoute } from './-drafts'

export const Route = createFileRoute('/$tenant/social/drafts')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: DraftsRoute,
})
