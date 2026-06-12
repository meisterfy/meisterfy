import { describe, it, expect } from 'vitest'
import type { AdminPermission, AdminRole } from '@/lib/api/admin-users'
import {
  permLabel,
  roleLabel,
  isSystemRole,
  groupPermissions,
  togglePerm,
  toggleGroup,
  selectAllToggle,
} from './roles-permissions'

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

// Returns the defaultValue if provided, else the key — used for label tests
const fallbackT = (key: string, opts?: { defaultValue?: string }) =>
  opts?.defaultValue ?? key

// Returns the key unchanged — used for groupPermissions tests where we just
// need stable label strings
const keyT = (key: string, _opts?: { defaultValue?: string }) => key

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makePermission = (name: string): AdminPermission => ({ id: name, name })

const PERMS: AdminPermission[] = [
  // content group
  makePermission('create:post'),
  makePermission('update:post'),
  makePermission('read:content'),
  // advertising group
  makePermission('create:campaign'),
  makePermission('view:report'),
  makePermission('read:analytics'),
  // users group
  makePermission('create:user'),
  makePermission('update:role'),
  makePermission('read:tenant'),
  // integrations group
  makePermission('create:integration'),
  makePermission('manage:automation'),
  // other (no match)
  makePermission('read:audit'),
]

// ---------------------------------------------------------------------------
// permLabel
// ---------------------------------------------------------------------------

describe('permLabel', () => {
  it('translates dashes and colons to underscores for the key', () => {
    const t = (key: string, _opts?: { defaultValue?: string }) =>
      `translated:${key}`
    expect(permLabel(t, 'create:post')).toBe(
      'translated:permissions:create_post',
    )
  })

  it('falls back to raw name when t returns defaultValue', () => {
    expect(permLabel(fallbackT, 'create:post')).toBe('create:post')
  })

  it('handles dashes in permission name', () => {
    expect(permLabel(fallbackT, 'read-content')).toBe('read-content')
  })
})

// ---------------------------------------------------------------------------
// roleLabel
// ---------------------------------------------------------------------------

describe('roleLabel', () => {
  it('translates dashes to underscores for the settings key', () => {
    const t = (key: string, _opts?: { defaultValue?: string }) =>
      `[${key}]`
    expect(roleLabel(t, 'super-admin')).toBe(
      '[settings:roles_name_super_admin]',
    )
  })

  it('falls back to raw name when key is missing', () => {
    expect(roleLabel(fallbackT, 'admin')).toBe('admin')
  })
})

// ---------------------------------------------------------------------------
// isSystemRole
// ---------------------------------------------------------------------------

describe('isSystemRole', () => {
  const base: AdminRole = { id: '1', name: 'admin', permissions: [] }

  it('returns true when tenant_id is null', () => {
    expect(isSystemRole({ ...base, tenant_id: null })).toBe(true)
  })

  it('returns true when tenant_id is undefined', () => {
    expect(isSystemRole({ ...base, tenant_id: undefined })).toBe(true)
  })

  it('returns false when tenant_id is a non-empty string', () => {
    expect(isSystemRole({ ...base, tenant_id: 'tenant-a' })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// groupPermissions
// ---------------------------------------------------------------------------

describe('groupPermissions', () => {
  it('buckets permissions into the expected groups', () => {
    const groups = groupPermissions(PERMS, new Set(), keyT)
    const keys = groups.map((g) => g.key)
    expect(keys).toContain('content')
    expect(keys).toContain('advertising')
    expect(keys).toContain('users')
    expect(keys).toContain('integrations')
  })

  it('puts unmatched permissions into an other bucket', () => {
    const groups = groupPermissions(PERMS, new Set(), keyT)
    const other = groups.find((g) => g.key === 'other')
    expect(other).toBeDefined()
    expect(other!.perms.map((p) => p.name)).toContain('read:audit')
  })

  it('does not include other bucket when all perms match a group', () => {
    const noOther: AdminPermission[] = [
      makePermission('create:post'),
      makePermission('create:user'),
    ]
    const groups = groupPermissions(noOther, new Set(), keyT)
    expect(groups.find((g) => g.key === 'other')).toBeUndefined()
  })

  it('marks has=true for perms in the permSet', () => {
    const permSet = new Set(['create:post'])
    const groups = groupPermissions(PERMS, permSet, keyT)
    const content = groups.find((g) => g.key === 'content')!
    const createPost = content.perms.find((p) => p.name === 'create:post')!
    const updatePost = content.perms.find((p) => p.name === 'update:post')!
    expect(createPost.has).toBe(true)
    expect(updatePost.has).toBe(false)
  })

  it('uses t to build group labels with the settings: prefix', () => {
    const groups = groupPermissions(PERMS, new Set(), keyT)
    const content = groups.find((g) => g.key === 'content')!
    expect(content.label).toBe('settings:roles_perm_group_content')
  })

  it('skips a group entirely when no permissions match it', () => {
    // Only integrations perms — advertising group should be absent
    const limited: AdminPermission[] = [makePermission('create:integration')]
    const groups = groupPermissions(limited, new Set(), keyT)
    expect(groups.find((g) => g.key === 'advertising')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// togglePerm
// ---------------------------------------------------------------------------

describe('togglePerm', () => {
  it('adds a perm that is not in the set', () => {
    const original = new Set(['a'])
    const next = togglePerm(original, 'b')
    expect(next.has('b')).toBe(true)
  })

  it('removes a perm that is in the set', () => {
    const original = new Set(['a', 'b'])
    const next = togglePerm(original, 'a')
    expect(next.has('a')).toBe(false)
  })

  it('does not mutate the original set', () => {
    const original = new Set(['a'])
    togglePerm(original, 'b')
    expect(original.has('b')).toBe(false)
    expect(original.size).toBe(1)
  })

  it('returns a new Set instance', () => {
    const original = new Set(['a'])
    const next = togglePerm(original, 'b')
    expect(next).not.toBe(original)
  })
})

// ---------------------------------------------------------------------------
// toggleGroup
// ---------------------------------------------------------------------------

describe('toggleGroup', () => {
  const contentPerms = PERMS.filter(
    (p) => p.name.includes('post') || p.name.includes('content'),
  )

  it('adds all group perms when none are present (partial → all)', () => {
    const empty = new Set<string>()
    const next = toggleGroup(PERMS, empty, 'content')
    contentPerms.forEach((p) => expect(next.has(p.name)).toBe(true))
  })

  it('adds all group perms when only some are present (partial → all)', () => {
    const partial = new Set(['create:post'])
    const next = toggleGroup(PERMS, partial, 'content')
    contentPerms.forEach((p) => expect(next.has(p.name)).toBe(true))
  })

  it('removes all group perms when all are present (full → none)', () => {
    const full = new Set(contentPerms.map((p) => p.name))
    const next = toggleGroup(PERMS, full, 'content')
    contentPerms.forEach((p) => expect(next.has(p.name)).toBe(false))
  })

  it('does not mutate the original set', () => {
    const original = new Set<string>()
    toggleGroup(PERMS, original, 'content')
    expect(original.size).toBe(0)
  })

  it('handles the other group key for unmatched perms', () => {
    const empty = new Set<string>()
    const next = toggleGroup(PERMS, empty, 'other')
    // read:audit is in the "other" bucket
    expect(next.has('read:audit')).toBe(true)
    // create:post is NOT in other
    expect(next.has('create:post')).toBe(false)
  })

  it('removes other group perms when all present', () => {
    const full = new Set(['read:audit'])
    const next = toggleGroup(PERMS, full, 'other')
    expect(next.has('read:audit')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// selectAllToggle
// ---------------------------------------------------------------------------

describe('selectAllToggle', () => {
  it('selects all when set is empty', () => {
    const next = selectAllToggle(new Set(), PERMS)
    expect(next.size).toBe(PERMS.length)
    PERMS.forEach((p) => expect(next.has(p.name)).toBe(true))
  })

  it('clears when set is fully populated', () => {
    const full = new Set(PERMS.map((p) => p.name))
    const next = selectAllToggle(full, PERMS)
    expect(next.size).toBe(0)
  })

  it('selects all when set is partially populated', () => {
    const partial = new Set(['create:post'])
    const next = selectAllToggle(partial, PERMS)
    expect(next.size).toBe(PERMS.length)
  })

  it('does not mutate the original set', () => {
    const original = new Set<string>()
    selectAllToggle(original, PERMS)
    expect(original.size).toBe(0)
  })

  it('returns a new Set instance', () => {
    const original = new Set(PERMS.map((p) => p.name))
    const next = selectAllToggle(original, PERMS)
    expect(next).not.toBe(original)
  })
})
