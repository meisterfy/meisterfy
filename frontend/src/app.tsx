import { useEffect, useState } from 'react'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { useAuth } from './store/auth'
import { Toaster } from './components/ui/sonner'
import './lib/i18n'

const router = createRouter({ routeTree })
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const queryClient = new QueryClient()

export default function App() {
  const [ready, setReady] = useState(false)
  const restore = useAuth((s) => s.restoreSession)
  useEffect(() => {
    restore()
      .catch(() => {})
      .finally(() => setReady(true))
  }, [restore])
  if (!ready) return null
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors />
    </QueryClientProvider>
  )
}
