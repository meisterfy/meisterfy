import { useEffect } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useAuth } from '@/store/auth'
import { TermsWall } from '@/components/terms-wall'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const isAuthenticated = useAuth((s) => s.isAuthenticated)
  const pendingTerms = useAuth((s) => s.pendingTerms)

  // Remove the #app-loading overlay injected by index.html on first paint.
  // Deviation from Svelte: no ModeWatcher needed — theme is applied by the A4 theme store on load.
  useEffect(() => {
    const overlay = document.getElementById('app-loading')
    if (overlay) {
      overlay.classList.add('done')
      const timer = setTimeout(() => overlay.remove(), 220)
      return () => clearTimeout(timer)
    }
  }, [])

  if (isAuthenticated() && pendingTerms !== null) {
    return <TermsWall terms={pendingTerms} />
  }

  return <Outlet />
}
