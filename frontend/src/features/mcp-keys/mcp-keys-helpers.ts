// Pure helpers for MCP key display — ported faithfully from the Svelte source.

export type TFn = (key: string) => string

// ---------------------------------------------------------------------------
// roleBadgeClass
// ---------------------------------------------------------------------------

export function roleBadgeClass(role: string): string {
  if (role === 'admin') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  if (role === 'editor') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
}

// ---------------------------------------------------------------------------
// roleLabel
// ---------------------------------------------------------------------------

export function roleLabel(t: TFn, role: string): string {
  if (role === 'admin') return t('mcp_role_admin')
  if (role === 'editor') return t('mcp_role_editor')
  return t('mcp_role_readonly')
}

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

export function formatDate(t: TFn, dateStr: string | null): string {
  if (!dateStr) return t('mcp_never')
  return new Date(dateStr).toLocaleDateString()
}

// ---------------------------------------------------------------------------
// relativeTime
// ---------------------------------------------------------------------------

export function relativeTime(t: TFn, dateStr: string | null): string {
  if (!dateStr) return t('mcp_never')
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}
