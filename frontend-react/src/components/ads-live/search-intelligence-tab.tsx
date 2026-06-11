import { useTranslation } from 'react-i18next'
import { isSmartManaged } from '@/lib/api/campaigns'
import type {
  LiveCampaignDetail,
  SearchTermRow,
  KeywordQSRow,
  KeywordPerfRow,
} from '@/lib/api/campaigns'
import { SearchTermsTable } from './search-terms-table'
import { QualityScoreTable } from './quality-score-table'
import { KeywordPerformanceTable } from './keyword-performance-table'

export function SearchIntelligenceTab({
  detail,
  searchTerms,
  qualityScores,
  keywords,
}: {
  detail: LiveCampaignDetail | null
  searchTerms: SearchTermRow[]
  qualityScores: KeywordQSRow[]
  keywords: KeywordPerfRow[]
}) {
  const { t } = useTranslation('ads')
  const smart = detail ? isSmartManaged(detail.campaign.adGroups) : false

  return (
    <div className="space-y-6 py-6">
      {smart ? (
        <p className="text-sm text-slate-400">{t('analytics.smart_campaign_no_keywords')}</p>
      ) : (
        <>
          {qualityScores.length > 0 && <QualityScoreTable keywords={qualityScores} />}
          {keywords.length > 0 && <KeywordPerformanceTable keywords={keywords} />}
        </>
      )}

      {searchTerms.length > 0 && <SearchTermsTable terms={searchTerms} />}
    </div>
  )
}
