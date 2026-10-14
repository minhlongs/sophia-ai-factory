// i18n-namespace: marketplace.creator
'use client';

import { useTranslations } from 'next-intl';

interface ListingFiltersProps {
  actionError: string | null;
  onCreateClick: () => void;
}

export function ListingFilters({ actionError, onCreateClick }: ListingFiltersProps) {
  const t = useTranslations('marketplace.creator');

  return (
    <div>
      {actionError && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400">
          {actionError}
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={onCreateClick}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('createListing')}
        </button>
      </div>
    </div>
  );
}
