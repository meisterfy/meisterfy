import type { LucideIcon } from 'lucide-react'
import { Pencil, Trash2, Link2, CircleCheck, CircleX, CircleAlert, UsersRound } from 'lucide-react'
import { ProviderIcon } from '@/components/provider-icon'
import type { Integration, ProviderSchema } from '@/lib/api/integrations'
import { ConnectionCard } from './connection-card'
import { CardFooterBtn } from './card-footer-btn'
import { CardBadge } from './card-badge'

interface TenantOption {
  value: string
  label: string
}

interface CardConnectedProps {
  integration: Integration
  provider: ProviderSchema
  tenantOptions?: TenantOption[]
  onEdit: () => void
  onDelete: () => void
  onConnect?: () => void
}

type StatusKey = 'connected' | 'pending' | 'error'

const STATUS_MAP: Record<StatusKey, { variant: 'success' | 'warning' | 'error'; Icon: LucideIcon }> = {
  connected: { variant: 'success', Icon: CircleCheck },
  pending: { variant: 'warning', Icon: CircleX },
  error: { variant: 'error', Icon: CircleAlert },
}

function CardConnected({
  integration,
  provider,
  tenantOptions,
  onEdit,
  onDelete,
  onConnect,
}: CardConnectedProps) {
  const status = STATUS_MAP[integration.status as StatusKey] ?? STATUS_MAP.pending

  const connectHref =
    provider.oauth_flow && provider.oauth_start_path
      ? `${provider.oauth_start_path}?integration_id=${integration.id}`
      : null

  const footer = (
    <div className="flex w-full items-center gap-2">
      {connectHref ? (
        <CardFooterBtn
          href={connectHref}
          variant="primary"
          label={integration.status === 'connected' ? 'Re-auth' : 'Connect'}
          icon={Link2}
        />
      ) : onConnect && integration.status !== 'connected' ? (
        <CardFooterBtn
          onClick={onConnect}
          variant="primary"
          label="Connect"
          icon={Link2}
        />
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <CardFooterBtn onClick={onEdit} variant="default" title="Edit" icon={Pencil} />
        <CardFooterBtn onClick={onDelete} variant="danger" title="Delete" icon={Trash2} />
      </div>
    </div>
  )

  return (
    <ConnectionCard footer={footer}>
      <div className="flex flex-row items-start justify-start gap-2 p-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-500/15 bg-slate-500/10">
          <div className="h-8 w-8 text-white">
            <ProviderIcon
              provider={provider.provider}
              logoSvg={provider.logo_svg}
              logoPng={provider.logo_png}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {provider.display_name}
              </h3>
              <p className="text-xs text-slate-400">{integration.name}</p>
            </div>
            <CardBadge variant={status.variant} icon={status.Icon} />
          </div>
          {integration.status === 'error' && integration.error_message && (
            <p className="truncate text-[10px] font-medium text-red-500">
              {integration.error_message}
            </p>
          )}
        </div>
      </div>
      {integration.tenant_ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-t-slate-500/20 px-4 pt-3 pb-1">
          <UsersRound className="h-4 w-4 text-slate-400" />
          {integration.tenant_ids.map((tid) => (
            <CardBadge
              key={tid}
              label={tenantOptions?.find((o) => o.value === tid)?.label ?? tid}
            />
          ))}
        </div>
      )}
    </ConnectionCard>
  )
}

export { CardConnected }
