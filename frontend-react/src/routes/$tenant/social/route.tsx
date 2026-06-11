import { createFileRoute, Link, Outlet, redirect, useLocation } from '@tanstack/react-router'
import { CalendarDays, File } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { SubToolbar } from '@/components/sub-toolbar'
import { SubToolbarLink, subToolbarLinkClass } from '@/components/sub-toolbar-link'

export const Route = createFileRoute('/$tenant/social')({
  beforeLoad: () => {
    if (!useAuth.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: SocialLayout,
})

function SocialLayout() {
  const { tenant } = Route.useParams()
  const isDrafts = useLocation().pathname.includes('/drafts')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SubToolbar>
        <div className="flex items-center gap-1">
          <Link to="/$tenant/social" params={{ tenant }} className={subToolbarLinkClass(!isDrafts)}>
            <CalendarDays className="h-4 w-4" />
            Planner
          </Link>
          {/* TODO(C4): typed <Link> once the drafts route is generated */}
          <SubToolbarLink
            href={`/${tenant}/social/drafts`}
            label="Drafts"
            icon={File}
            active={isDrafts}
          />
        </div>
      </SubToolbar>

      <Outlet />
    </div>
  )
}
