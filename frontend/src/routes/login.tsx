import { createFileRoute } from '@tanstack/react-router'
import { LoginRoute } from './-login'

export const Route = createFileRoute('/login')({
  component: LoginRoute,
})
