// i18n-namespace: marketplace.creator

import type { SopListingView } from '@/land/sop-marketplace';

export interface ListingsClientProps {
  initialListings: SopListingView[];
}

export type ActiveView =
  | { type: 'table' }
  | { type: 'create' }
  | { type: 'edit'; listing: SopListingView };

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};
