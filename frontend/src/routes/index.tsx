import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { HomeRoute } from './-index'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: HomeRoute,
})
