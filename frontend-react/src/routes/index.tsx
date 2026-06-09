import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => <div data-testid='home'>Meisterfy React — scaffold OK</div>,
})
