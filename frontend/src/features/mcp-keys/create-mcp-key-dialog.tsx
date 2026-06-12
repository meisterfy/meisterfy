import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { createMcpKey } from '@/lib/api/mcp-keys'
import type { CreateMcpKeyResponse } from '@/lib/api/mcp-keys'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { roleLabel, type TFn } from './mcp-keys-helpers'

interface CreateMcpKeyDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  tenant: string
  onDone: () => void
}

export function CreateMcpKeyDialog({
  open,
  onOpenChange,
  tenant,
  onDone,
}: CreateMcpKeyDialogProps) {
  const { t } = useTranslation('settings')

  const mcpUrl = `${window.location.origin}/mcp`
  const tenantSlug = tenant

  // ── Internal state (reset on open) ──────────────────────────────────────────
  const [createName, setCreateName] = useState('')
  const [createRole, setCreateRole] = useState('readonly')
  const [createExpires, setCreateExpires] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<CreateMcpKeyResponse | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)

  // Reset all state whenever the dialog opens (adjust state during render,
  // mirrors Svelte openCreateDialog)
  const [prevOpen, setPrevOpen] = useState<boolean | null>(null)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setCreateName('')
      setCreateRole('readonly')
      setCreateExpires('')
      setCreateError(null)
      setCreatedKey(null)
      setCreateLoading(false)
      setCopiedKey(false)
      setCopiedUrl(false)
      setCopiedJson(false)
    }
  }

  // ── handleCreate — faithful port of Svelte lines 62-78 ──────────────────────
  async function handleCreate() {
    setCreateError(null)
    if (!createName.trim()) return
    setCreateLoading(true)
    try {
      const result = await createMcpKey(tenant, {
        name: createName.trim(),
        role: createRole,
        ...(createExpires ? { expires_at: new Date(createExpires).toISOString() } : {}),
      })
      setCreatedKey(result)
    } catch {
      setCreateError('Something went wrong')
    } finally {
      setCreateLoading(false)
    }
  }

  // ── copy — port of Svelte lines 135-155 ─────────────────────────────────────
  function copy(text: string, which: 'key' | 'url' | 'json') {
    navigator.clipboard.writeText(text)
    if (which === 'key') {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    }
    if (which === 'url') {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    }
    if (which === 'json') {
      setCopiedJson(true)
      setTimeout(() => setCopiedJson(false), 2000)
    }
  }

  // ── jsonSnippet — port of Svelte lines 157-173 ──────────────────────────────
  const jsonSnippet = useMemo(
    () =>
      createdKey
        ? JSON.stringify(
            {
              mcpServers: {
                [`${tenantSlug}-meisterfy`]: {
                  type: 'http',
                  url: mcpUrl,
                  headers: { Authorization: `Bearer ${createdKey.key}` },
                },
              },
            },
            null,
            2,
          )
        : '',
    // mcpUrl and tenantSlug are stable (derived from props/window) — only
    // recompute when createdKey changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createdKey],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg p-0' showCloseButton={false}>
        <DialogHeader className='border-border border-b px-6 py-4'>
          <DialogTitle>
            {createdKey ? t('mcp_created_title') : t('mcp_create_title')}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4 px-6 py-5'>
          {createdKey ? (
            <>
              {/* created phase — lines 280-333 */}
              <p className='text-sm font-medium text-amber-600 dark:text-amber-400'>
                {t('mcp_created_desc')}
              </p>

              {/* Full key */}
              <div>
                <p className='text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase'>
                  API Key
                </p>
                <div className='flex items-center gap-2'>
                  <code className='bg-muted flex-1 rounded px-3 py-2 font-mono text-xs break-all'>
                    {createdKey.key}
                  </code>
                  <button
                    onClick={() => copy(createdKey!.key, 'key')}
                    className='text-muted-foreground hover:text-foreground shrink-0 rounded border border-slate-200 px-2 py-1.5 text-xs transition-colors dark:border-slate-700'
                  >
                    {copiedKey ? t('mcp_copied') : t('mcp_copy')}
                  </button>
                </div>
              </div>

              {/* MCP URL */}
              <div>
                <p className='text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase'>
                  {t('mcp_created_mcp_url')}
                </p>
                <div className='flex items-center gap-2'>
                  <code className='bg-muted flex-1 rounded px-3 py-2 font-mono text-xs'>
                    {mcpUrl}
                  </code>
                  <button
                    onClick={() => copy(mcpUrl, 'url')}
                    className='text-muted-foreground hover:text-foreground shrink-0 rounded border border-slate-200 px-2 py-1.5 text-xs transition-colors dark:border-slate-700'
                  >
                    {copiedUrl ? t('mcp_copied') : t('mcp_copy')}
                  </button>
                </div>
              </div>

              {/* JSON snippet */}
              <div>
                <p className='text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase'>
                  {t('mcp_created_json')}
                </p>
                <div className='relative'>
                  <pre className='bg-muted overflow-x-auto rounded p-3 font-mono text-xs'>
                    {jsonSnippet}
                  </pre>
                  <button
                    onClick={() => copy(jsonSnippet, 'json')}
                    className='text-muted-foreground hover:text-foreground absolute top-2 right-2 rounded border border-slate-200 px-2 py-1 text-xs transition-colors dark:border-slate-700'
                  >
                    {copiedJson ? t('mcp_copied') : t('mcp_copy')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* form phase — lines 334-387 */}
              <div>
                <label
                  htmlFor='create-name'
                  className='text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase'
                >
                  {t('mcp_create_field_name')}
                </label>
                <Input
                  id='create-name'
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t('mcp_create_field_name_placeholder')}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor='create-role'
                  className='text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase'
                >
                  {t('mcp_create_field_role')}
                </label>
                <Select
                  value={createRole}
                  onValueChange={(v) => v && setCreateRole(v as string)}
                >
                  <SelectTrigger id='create-role' className='w-full'>
                    <SelectValue>{roleLabel(t as TFn, createRole)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='readonly'>{t('mcp_role_readonly')}</SelectItem>
                    <SelectItem value='editor'>{t('mcp_role_editor')}</SelectItem>
                    <SelectItem value='admin'>{t('mcp_role_admin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor='create-expires'
                  className='text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase'
                >
                  {t('mcp_create_field_expires')}
                </label>
                <Input
                  id='create-expires'
                  type='date'
                  value={createExpires}
                  onChange={(e) => setCreateExpires(e.target.value)}
                />
              </div>

              {createError && (
                <p className='rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400'>
                  {createError}
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter className='border-border flex justify-end gap-2 border-t px-6 py-4'>
          {createdKey ? (
            <Button className='h-10 px-6 text-sm' onClick={onDone}>
              {t('mcp_created_done')}
            </Button>
          ) : (
            <>
              <DialogClose className='rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'>
                Cancel
              </DialogClose>
              <Button
                onClick={handleCreate}
                disabled={createLoading || !createName.trim()}
                className='h-10 px-6 text-sm'
              >
                {createLoading ? '…' : t('mcp_create_submit')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
