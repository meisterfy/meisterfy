import { useTranslation } from 'react-i18next'
import { Book } from 'lucide-react'
import { ProviderIcon } from '@/components/provider-icon'
import type { ProviderSchema } from '@/lib/api/integrations'
import { ConnectionCard } from './connection-card'
import { CardFooterBtn } from './card-footer-btn'

interface CardAddProps {
  provider: ProviderSchema
  onClick: () => void
}

function CardAdd({ provider, onClick }: CardAddProps) {
  const { t } = useTranslation('integrations')

  const footer = (
    <>
      <div className="mr-auto text-[10px] font-bold text-slate-200 uppercase">
        #{provider.group.replace('_', '-')}
      </div>
      <CardFooterBtn href="#" variant="ghost" label={t('read_docs')} icon={Book} />
      <CardFooterBtn onClick={onClick} variant="primary" label={t('add_connection')} />
    </>
  )

  return (
    <ConnectionCard variant="border" footer={footer}>
      <div className="flex flex-row items-start justify-start gap-2 p-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-500/15 bg-slate-500/10 p-2">
          <ProviderIcon
            provider={provider.provider}
            logoSvg={provider.logo_svg}
            logoPng={provider.logo_png}
          />
        </div>
        <div className="flex flex-col">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {provider.display_name}
          </h3>
          <p className="text-xs text-slate-400">{provider.description}</p>
        </div>
      </div>
    </ConnectionCard>
  )
}

export { CardAdd }
