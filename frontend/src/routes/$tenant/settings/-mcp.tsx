import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/store/auth'
import { listMcpKeys, revokeMcpKey } from '@/lib/api/mcp-keys'
import type { McpApiKey } from '@/lib/api/mcp-keys'
import { SectionTitle } from '@/components/section-title'
import { SettingsSkeleton } from '@/components/settings-skeleton'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CreateMcpKeyDialog } from '@/features/mcp-keys/create-mcp-key-dialog'
import {
  roleBadgeClass,
  roleLabel,
  formatDate,
  relativeTime,
  type TFn,
} from '@/features/mcp-keys/mcp-keys-helpers'
import { Route } from './mcp'

export function McpRoute() {
  const { tenant } = Route.useParams()
  const { t } = useTranslation('settings')
  const canManage = useAuth(
    (s) => s.user?.permissions?.includes('manage:mcp-keys') ?? false,
  )

  // ── State ──────────────────────────────────────────────────────────────────
  const [keys, setKeys] = useState<McpApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<McpApiKey | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)

  // ── Load function — imperative, mirrors the Svelte $effect + audit.tsx ─────
  async function loadKeys() {
    setIsLoading(true)
    setKeys(await listMcpKeys(tenant).catch(() => []))
    setIsLoading(false)
  }

  // Initial load — inline fetch keeps the loading flag out of the effect body
  // (loadKeys() is reused by the revoke handler, where setState is fine).
  useEffect(() => {
    let active = true
    listMcpKeys(tenant)
      .catch(() => [])
      .then((k) => {
        if (!active) return
        setKeys(k)
        setIsLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── handleRevoke — port of Svelte lines 90-104 ────────────────────────────
  async function handleRevoke() {
    if (!revokeTarget) return
    setIsRevoking(true)
    try {
      await revokeMcpKey(tenant, revokeTarget.id)
      setKeys((ks) => ks.filter((k) => k.id !== revokeTarget!.id))
      setShowRevokeDialog(false)
      setRevokeTarget(null)
      toast.success(t('mcp_revoke_confirm'))
    } catch {
      toast.error('Failed to revoke key')
    } finally {
      setIsRevoking(false)
    }
  }

  function openCreateDialog() {
    setShowCreateDialog(true)
  }

  // Called when the create dialog "Done" button is clicked
  function onDone() {
    setShowCreateDialog(false)
    void loadKeys()
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <SettingsSkeleton rows={5} />
  }

  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        <SectionTitle
          title={t('mcp_title')}
          icon={<KeyRound className="text-muted-foreground h-5 w-5" />}
        >
          {canManage && (
            <Button
              onClick={openCreateDialog}
              className="flex h-9 items-center gap-2 px-3 text-sm"
            >
              + {t('mcp_new_key')}
            </Button>
          )}
        </SectionTitle>

        <p className="text-muted-foreground text-sm">{t('mcp_desc')}</p>

        {keys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center dark:border-slate-700">
            <KeyRound className="text-muted-foreground mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-muted-foreground text-sm">{t('mcp_empty')}</p>
            {canManage && (
              <Button
                onClick={openCreateDialog}
                className="mt-4 h-9 px-4 text-sm"
              >
                + {t('mcp_new_key')}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border border-b text-left">
                  <th className="text-muted-foreground pr-4 pb-3 font-medium">
                    {t('mcp_col_name')}
                  </th>
                  <th className="text-muted-foreground pr-4 pb-3 font-medium">
                    {t('mcp_col_role')}
                  </th>
                  <th className="text-muted-foreground pr-4 pb-3 font-medium">
                    {t('mcp_col_prefix')}
                  </th>
                  <th className="text-muted-foreground pr-4 pb-3 font-medium">
                    {t('mcp_col_created')}
                  </th>
                  <th className="text-muted-foreground pr-4 pb-3 font-medium">
                    {t('mcp_col_last_used')}
                  </th>
                  <th className="text-muted-foreground pr-4 pb-3 font-medium">
                    {t('mcp_col_expires')}
                  </th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr
                    key={key.id}
                    className="border-border border-b last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium">{key.name}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass(key.role)}`}
                      >
                        {roleLabel(t as TFn, key.role)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <code className="text-muted-foreground font-mono text-xs">
                        {key.key_prefix}…
                      </code>
                    </td>
                    <td className="text-muted-foreground py-3 pr-4">
                      {formatDate(t as TFn, key.created_at)}
                    </td>
                    <td className="text-muted-foreground py-3 pr-4">
                      {relativeTime(t as TFn, key.last_used_at)}
                    </td>
                    <td className="text-muted-foreground py-3 pr-4">
                      {formatDate(t as TFn, key.expires_at)}
                    </td>
                    <td className="py-3 text-right">
                      {canManage && (
                        <button
                          className="text-muted-foreground hover:text-destructive text-sm transition-colors"
                          onClick={() => {
                            setRevokeTarget(key)
                            setShowRevokeDialog(true)
                          }}
                        >
                          {t('mcp_revoke')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateMcpKeyDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        tenant={tenant}
        onDone={onDone}
      />

      <ConfirmDialog
        open={showRevokeDialog}
        onOpenChange={setShowRevokeDialog}
        title={t('mcp_revoke_title')}
        description={t('mcp_revoke_desc')}
        confirmLabel={t('mcp_revoke_confirm')}
        isLoading={isRevoking}
        onConfirm={handleRevoke}
      />
    </>
  )
}
