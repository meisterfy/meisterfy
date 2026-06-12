// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('design tokens (TASK-091)', () => {
  it('maps the shadcn primary/border tokens to the brand vars', () => {
    const css = readFileSync(resolve(__dirname, 'app.css'), 'utf8')
    // brand indigo/slate own primary/border (exact var names per the file)
    expect(css).toMatch(/--(color-)?primary:\s*var\(--primary-base\)/)
    expect(css).toMatch(/--(color-)?border:\s*var\(--border-color\)/)
  })
})
