import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { McpRoute } from './-mcp'

export const Route = createFileRoute('/$tenant/settings/mcp')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: McpRoute,
})
