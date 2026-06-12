// Minimal translator signature — accepts the full react-i18next TFunction
// shape but also works with any (key, opts?) => string stub in tests.
export type TFn = (key: string, opts?: { defaultValue?: string }) => string

// ---------------------------------------------------------------------------
// avatarColor
// ---------------------------------------------------------------------------

const COLORS = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-cyan-500',
]

export function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff
  return COLORS[hash % COLORS.length]
}

// ---------------------------------------------------------------------------
// initials
// ---------------------------------------------------------------------------

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// ---------------------------------------------------------------------------
// localeName
// ---------------------------------------------------------------------------

export function localeName(locale: string, t: TFn): string {
  return locale === 'pt-BR' ? t('lang_pt_br') : t('lang_en_us')
}

// ---------------------------------------------------------------------------
// roleName
// ---------------------------------------------------------------------------

export function roleName(
  role: { id: string; name: string } | undefined,
  t: TFn,
): string {
  if (!role) return '—'
  return t(`roles_name_${role.name}`, { defaultValue: role.name })
}
