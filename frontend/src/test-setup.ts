import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom doesn't implement these layout/pointer APIs that @base-ui's Select,
// Popover and Dialog parts call on open. Without the stubs jsdom logs
// "Not implemented" and user-event interactions can stall, making the
// interaction-heavy tests (multi-select, modal, drawers) flaky/time out.
// Guarded so the setup is a no-op in node-environment tests (e.g. tokens.test.ts).
if (typeof window !== 'undefined') {
  window.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
}
