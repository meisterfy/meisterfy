import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface IntegrationFiltersProps {
  searchQuery: string
  onSearchChange: (v: string) => void
  selectedCategory: string
  onCategoryChange: (v: string) => void
  categories: string[]
  categoryLabels: Record<string, string>
  onClear: () => void
}

function IntegrationFilters({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
  categoryLabels,
  onClear,
}: IntegrationFiltersProps) {
  const { t } = useTranslation('integrations')

  return (
    <div className="flex flex-wrap items-center gap-3">
      {(searchQuery !== '' || selectedCategory !== 'all') && (
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {t('filter_clear')}
        </button>
      )}

      <div className="relative min-w-[240px]">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder={t('filter_search_placeholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pr-10 pl-9"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className={cn(
              'absolute top-1/2 right-2 -translate-y-1/2',
              'inline-flex items-center justify-center rounded p-0.5',
              'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200',
            )}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Select value={selectedCategory} onValueChange={(v) => onCategoryChange(v ?? 'all')}>
        <SelectTrigger className="w-[200px]">
          <SelectValue>
            {selectedCategory === 'all'
              ? t('filter_all_categories')
              : (categoryLabels[selectedCategory] ?? selectedCategory)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filter_all_categories')}</SelectItem>
          {categories.map((group) => (
            <SelectItem key={group} value={group}>
              {categoryLabels[group] ?? group}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export { IntegrationFilters }
