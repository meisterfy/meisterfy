import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Guard: every bundled namespace must have identical key sets in en and pt-BR.
// Catches the inherited drift (Phase-2 found pt-BR incomplete) from recurring.
const EN_DIR = 'src/locales/en'
const PT_DIR = 'src/locales/pt-BR'

type Json = Record<string, unknown>

function flatten(obj: Json, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    const full = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Json, full))
    } else {
      out[full] = value
    }
  }
  return out
}

const read = (dir: string, file: string) =>
  flatten(JSON.parse(readFileSync(join(dir, file), 'utf8')) as Json)

describe('i18n locale parity (en <-> pt-BR)', () => {
  const namespaces = readdirSync(EN_DIR).filter((f) => f.endsWith('.json'))

  it.each(namespaces)('%s has matching key sets in both locales', (file) => {
    const en = read(EN_DIR, file)
    const pt = read(PT_DIR, file)
    const missingInPt = Object.keys(en).filter((k) => !(k in pt))
    const extraInPt = Object.keys(pt).filter((k) => !(k in en))
    expect({ missingInPt, extraInPt }).toEqual({ missingInPt: [], extraInPt: [] })
  })
})
