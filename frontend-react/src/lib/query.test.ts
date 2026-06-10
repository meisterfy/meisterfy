import { describe, expect, it } from 'vitest'
import { fallbackQuery, qk } from './query'

describe('qk query keys', () => {
  it('builds tenant-scoped list keys', () => {
    expect(qk.campaigns('acme')).toEqual(['campaigns', 'acme'])
    expect(qk.auditLog('acme')).toEqual(['audit-log', 'acme'])
    expect(qk.mcpKeys('acme')).toEqual(['mcp-keys', 'acme'])
    expect(qk.socialAccounts('acme')).toEqual(['social-accounts', 'acme'])
  })

  it('encodes optional status as null when omitted', () => {
    expect(qk.posts('acme')).toEqual(['posts', 'acme', null])
    expect(qk.posts('acme', 'draft')).toEqual(['posts', 'acme', 'draft'])
    expect(qk.pendingAdjustments('acme')).toEqual(['pending-adjustments', 'acme', null])
  })

  it('builds multi-param keys', () => {
    expect(qk.campaign('acme', 'spring-sale')).toEqual(['campaign', 'acme', 'spring-sale'])
    expect(qk.connectorResources('acme', 'meta', 'page')).toEqual([
      'connector-resources',
      'acme',
      'meta',
      'page'
    ])
    expect(qk.aiReports('acme', 'c1', 'instant')).toEqual(['ai-reports', 'acme', 'c1', 'instant'])
    expect(qk.legalVersion('v1')).toEqual(['legal-version', 'v1'])
  })
})

describe('fallbackQuery', () => {
  it('returns the resolved value on success', async () => {
    expect(await fallbackQuery(async () => 42, 0)).toBe(42)
  })

  it('returns the fallback when the fn throws', async () => {
    expect(
      await fallbackQuery(async () => {
        throw new Error('boom')
      }, 'fallback')
    ).toBe('fallback')
  })
})
