import { useTranslation } from 'react-i18next'
import { FlaskConical } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { MultiSelect } from '@/components/ui/multi-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProviderIcon } from '@/components/provider-icon'
import type { FieldSchema } from '@/lib/api/integrations'
import type { useIntegrationManager } from './use-integration-manager'

interface IntegrationModalProps {
  manager: ReturnType<typeof useIntegrationManager>
  onSave: (e: React.FormEvent<HTMLFormElement>) => void
  onTest: () => void
}

interface FieldGroupProps {
  fields: FieldSchema[] | undefined
  label: string
  isCredential: boolean
  form: Record<string, string>
  editingId: string | null
  setFormField: (key: string, value: string) => void
}

function FieldGroup({
  fields,
  label,
  isCredential,
  form,
  editingId,
  setFormField,
}: FieldGroupProps) {
  if (!fields?.length) return null

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
      <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {label}
      </p>
      {fields.map((field) => (
        <div key={field.key}>
          <label
            htmlFor={`field-${field.key}`}
            className="mb-1 block text-xs font-semibold text-slate-500"
          >
            {field.label}
            {field.required && <span className="text-red-400">*</span>}
          </label>
          {field.type === 'select' && field.options?.length ? (
            <Select
              value={form[field.key] ?? field.options[0]?.value}
              onValueChange={(v) => setFormField(field.key, v ?? '')}
            >
              <SelectTrigger className="w-full border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <SelectValue>
                  {field.options.find((o) => o.value === form[field.key])
                    ?.label ?? field.options[0]?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <input
              id={`field-${field.key}`}
              type={!isCredential && field.type === 'url' ? 'url' : 'text'}
              value={form[field.key] ?? ''}
              onChange={(e) => setFormField(field.key, e.target.value)}
              placeholder={field.placeholder ?? ''}
              required={
                isCredential ? field.required && !editingId : field.required
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          )}
          {field.help_text && (
            <p className="mt-0.5 text-xs text-slate-400">{field.help_text}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// IntegrationModal
// ---------------------------------------------------------------------------

function IntegrationModal({ manager, onSave, onTest }: IntegrationModalProps) {
  const { t } = useTranslation('integrations')
  const p = manager.activeProvider

  return (
    <Dialog open={manager.showModal} onOpenChange={manager.setShowModal}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6"
      >
        {p && (
          <>
            {/* Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 text-slate-900 dark:text-white">
                <ProviderIcon
                  provider={p.provider}
                  logoSvg={p.logo_svg}
                  logoPng={p.logo_png}
                />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  {manager.editingId
                    ? `Edit ${p.display_name}`
                    : `Add ${p.display_name}`}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                  {p.description}
                </DialogDescription>
              </div>
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                onSave(e)
              }}
              className="flex flex-col gap-4"
            >
              {/* Name */}
              <div>
                <label
                  htmlFor="int-name"
                  className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
                >
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="int-name"
                  type="text"
                  value={manager.formName}
                  onChange={(e) => manager.setFormName(e.target.value)}
                  placeholder={t('modal_name_placeholder')}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Config fields */}
              <FieldGroup
                fields={p.config_fields}
                label="Configuration"
                isCredential={false}
                form={manager.form}
                editingId={manager.editingId}
                setFormField={manager.setFormField}
              />

              {/* Credential fields */}
              <FieldGroup
                fields={p.credential_fields}
                label="Credentials"
                isCredential={true}
                form={manager.form}
                editingId={manager.editingId}
                setFormField={manager.setFormField}
              />

              {/* Clients */}
              <div>
                <p className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {t('modal_assign_clients')}
                </p>
                <MultiSelect
                  value={manager.formTenants}
                  onChange={(v) => manager.setFormTenants(v)}
                  options={manager.tenantOptions}
                  placeholder={t('modal_clients_placeholder')}
                />
              </div>

              {/* OAuth note */}
              {p.oauth_flow && !manager.editingId && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  {t('modal_oauth_note')}
                </p>
              )}

              {/* Footer */}
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  {manager.editingId && (
                    <button
                      type="button"
                      onClick={onTest}
                      disabled={manager.isTesting}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <FlaskConical className="h-3.5 w-3.5" />
                      {manager.isTesting ? 'Testing…' : 'Test'}
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => manager.setShowModal(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={manager.isSubmitting}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {manager.isSubmitting
                      ? 'Saving…'
                      : p.oauth_flow && !manager.editingId
                        ? 'Save & Connect'
                        : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { IntegrationModal }
