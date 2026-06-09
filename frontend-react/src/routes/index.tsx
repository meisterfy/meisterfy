import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '../store/auth'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: () => <div data-testid='home'>home</div>,
})
