// i18n-namespace: dashboard.ip

import React from 'react';
import { Search, Filter } from 'lucide-react';
import { Card, Input } from '@/components/stitch/ui';
import { TYPE_META } from './types';

interface TableFiltersProps {
  query: string;
  onQueryChange: (val: string) => void;
  typeFilter: string;
  onTypeFilterChange: (val: string) => void;
  t: (key: string) => string;
}

export function TableFilters({
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  t,
}: TableFiltersProps) {
  return (
    <Card padding="lg" className="mt-6 lg:col-span-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <Search className="h-4 w-4 text-on-surface-variant" />
          <Input
            placeholder={t('search')}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="flex-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-on-surface-variant" />
          <select
            className="rounded-lg border border-outline bg-surface px-3 py-2 text-body-sm"
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value)}
          >
            <option value="all">{t('filter.all')}</option>
            {Object.keys(TYPE_META).map((type) => (
              <option key={type} value={type}>
                {t(`type.${type}` as const)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Card>
  );
}
