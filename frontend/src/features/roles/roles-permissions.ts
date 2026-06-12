import type { AdminPermission, AdminRole } from '@/lib/api/admin-users'

// Minimal translator signature — accepts the full react-i18next TFunction
// shape but also works with any (key, opts?) => string stub in tests.
export type TFn = (key: string, opts?: { defaultValue?: string }) => string

// ---------------------------------------------------------------------------
// permLabel
// ---------------------------------------------------------------------------

export function permLabel(t: TFn, name: string): string {
  const key = `permissions:${name.replace(/-/g, '_').replace(/:/g, '_')}`
  return t(key, { defaultValue: name })
}

// ---------------------------------------------------------------------------
// roleLabel
// ---------------------------------------------------------------------------

export function roleLabel(t: TFn, name: string): string {
  const key = `settings:roles_name_${name.replace(/-/g, '_')}`
  return t(key, { defaultValue: name })
}

// ---------------------------------------------------------------------------
// isSystemRole
// ---------------------------------------------------------------------------

export function isSystemRole(role: AdminRole): boolean {
  return !role.tenant_id
}

// ---------------------------------------------------------------------------
// PERM_GROUPS
// ---------------------------------------------------------------------------

export const PERM_GROUPS: {
  key: string
  labelKey: string
  match: (p: string) => boolean
}[] = [
  {
    key: 'content',
    labelKey: 'roles_perm_group_content',
    match: (p) => p.includes('post') || p.includes('content'),
  },
  {
    key: 'advertising',
    labelKey: 'roles_perm_group_advertising',
    match: (p) =>
      p.includes('campaign') || p.includes('report') || p.includes('analytics'),
  },
  {
    key: 'users',
    labelKey: 'roles_perm_group_users',
    match: (p) =>
      p.includes('user') || p.includes('role') || p.includes('tenant'),
  },
  {
    key: 'integrations',
    labelKey: 'roles_perm_group_integrations',
    match: (p) => p.includes('integration') || p.includes('automation'),
  },
]

// ---------------------------------------------------------------------------
// groupPermissions
// ---------------------------------------------------------------------------

export function groupPermissions(
  allPermissions: AdminPermission[],
  permSet: Set<string>,
  t: TFn,
): { key: string; label: string; perms: { name: string; has: boolean }[] }[] {
  const all = allPermissions.map((p) => p.name)
  const covered = new Set<string>()
  const groups: { key: string; label: string; perms: { name: string; has: boolean }[] }[] = []

  for (const g of PERM_GROUPS) {
    const perms = all.filter((p) => g.match(p))
    perms.forEach((p) => covered.add(p))
    if (perms.length > 0) {
      groups.push({
        key: g.key,
        label: t(`settings:${g.labelKey}`),
        perms: perms.map((p) => ({ name: p, has: permSet.has(p) })),
      })
    }
  }

  const others = all.filter((p) => !covered.has(p))
  if (others.length > 0) {
    groups.push({
      key: 'other',
      label: t('settings:roles_perm_group_other'),
      perms: others.map((p) => ({ name: p, has: permSet.has(p) })),
    })
  }

  return groups
}

// ---------------------------------------------------------------------------
// togglePerm — immutable
// ---------------------------------------------------------------------------

export function togglePerm(set: Set<string>, name: string): Set<string> {
  const next = new Set(set)
  if (next.has(name)) {
    next.delete(name)
  } else {
    next.add(name)
  }
  return next
}

// ---------------------------------------------------------------------------
// toggleGroup — immutable
// ---------------------------------------------------------------------------

export function toggleGroup(
  allPermissions: AdminPermission[],
  set: Set<string>,
  groupKey: string,
): Set<string> {
  const g = PERM_GROUPS.find((x) => x.key === groupKey)
  const matchFn: (p: string) => boolean = g
    ? g.match
    : (p) => !PERM_GROUPS.some((gx) => gx.match(p))

  const groupPerms = allPermissions.filter((p) => matchFn(p.name))
  const allInGroup = groupPerms.every((p) => set.has(p.name))

  const next = new Set(set)
  groupPerms.forEach((p) => {
    if (allInGroup) {
      next.delete(p.name)
    } else {
      next.add(p.name)
    }
  })
  return next
}

// ---------------------------------------------------------------------------
// selectAllToggle — immutable
// ---------------------------------------------------------------------------

export function selectAllToggle(
  set: Set<string>,
  allPermissions: AdminPermission[],
): Set<string> {
  if (set.size === allPermissions.length) {
    return new Set()
  }
  return new Set(allPermissions.map((p) => p.name))
}
