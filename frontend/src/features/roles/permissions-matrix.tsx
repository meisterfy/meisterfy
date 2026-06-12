// Reusable grouped-checkbox permissions grid.
// Used by both the role detail card and the create drawer (PART 2).

export interface PermGroup {
  key: string
  label: string
  perms: { name: string; has: boolean }[]
}

export interface PermissionsMatrixProps {
  groups: PermGroup[]
  onTogglePerm: (name: string) => void
  onToggleGroup: (groupKey: string) => void
  editable: boolean
  variant: 'detail' | 'create'
  permLabel: (name: string) => string
  gridClassName?: string
}

export function PermissionsMatrix({
  groups,
  onTogglePerm,
  onToggleGroup,
  editable,
  variant,
  permLabel,
  gridClassName,
}: PermissionsMatrixProps) {
  return (
    <div className={gridClassName}>
      {groups.map((group) => (
        <div key={group.key}>
          <div className='border-border mb-2.5 flex items-center justify-between border-b pb-2'>
            <p
              className={
                variant === 'detail'
                  ? 'text-muted-foreground text-xs font-semibold tracking-wide uppercase'
                  : 'text-sm font-semibold text-slate-900 dark:text-slate-100'
              }
            >
              {group.label}
            </p>
            {editable && (
              <button
                type='button'
                onClick={() => onToggleGroup(group.key)}
                className='rounded px-1 py-0.5 text-[10px] font-semibold tracking-wider text-indigo-600 uppercase transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300'
              >
                {group.perms.every((p) => p.has) ? 'None' : 'All'}
              </button>
            )}
          </div>
          <div className='flex flex-col gap-1.5'>
            {group.perms.map((perm) => (
              <label
                key={perm.name}
                className={[
                  'flex cursor-pointer items-center gap-2.5 rounded-md py-1 text-sm transition-colors',
                  editable ? 'hover:bg-muted/50' : '',
                ]
                  .join(' ')
                  .trim()}
              >
                <input
                  type='checkbox'
                  checked={perm.has}
                  disabled={!editable}
                  onChange={() => onTogglePerm(perm.name)}
                  className='h-4 w-4 rounded border-slate-300 accent-indigo-600 disabled:cursor-default'
                />
                <span className={perm.has ? '' : 'text-muted-foreground'}>
                  {permLabel(perm.name)}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
