import { render, screen } from '@testing-library/react'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { describe, it, expect } from 'vitest'

describe('router smoke', () => {
  it('renders the home route', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <div data-testid='home'>ok</div>,
    })
    const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) })
    render(<RouterProvider router={router} />)
    expect(await screen.findByTestId('home')).toBeInTheDocument()
  })
})
