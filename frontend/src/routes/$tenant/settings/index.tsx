import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$tenant/settings/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/$tenant/settings/general', params: { tenant: params.tenant } })
  },
  component: () => null,
})
