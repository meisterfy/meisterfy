import { describe, it, expect, vi } from 'vitest'

// ── Router mock ───────────────────────────────────────────────────────────────
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...original }
})

// ── Tests — /settings/ index redirect ────────────────────────────────────────

describe('/settings/ index', () => {
  it('redirect() from TanStack throws a Response with status 307', async () => {
    const { redirect } = await import('@tanstack/react-router')
    let thrown!: unknown
    try {
      throw redirect({ to: '/settings/integrations' })
    } catch (e) {
      thrown = e
    }
    // TanStack redirect throws a Response-like object with a 307 status
    expect(thrown).toBeTruthy()
    expect((thrown as Response).status).toBe(307)
  })

  it('Route is exported from the index module', async () => {
    const mod = await import('./index')
    expect(mod.Route).toBeDefined()
  })
})
