import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { PostEditorRoute } from './-post_id'

export const Route = createFileRoute('/$tenant/social/$post_id')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: PostEditorRoute,
})
