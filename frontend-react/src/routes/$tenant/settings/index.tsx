import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$tenant/settings/')({
  beforeLoad: ({ params }) => {
    // TODO(B8): switch to /general once it exists
    throw redirect({ to: '/$tenant/settings/users', params: { tenant: params.tenant } })
  },
  component: () => null,
})
