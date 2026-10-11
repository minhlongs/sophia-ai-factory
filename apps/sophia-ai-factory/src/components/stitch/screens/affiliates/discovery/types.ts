import type { AffiliateOffer } from '@/seed/types/affiliate';

export interface AffiliateDiscoveryPanelProps {
  initialOffers?: AffiliateOffer[];
}

export type SortOption = 'epc' | 'conversion' | 'commission' | 'quality';

export interface CategoryOption {
  readonly id: string;
  readonly key: string;
}

export interface PayoutModelOption {
  readonly id: string;
  readonly key: string;
}

export interface SortOptionItem {
  readonly id: SortOption;
  readonly key: 'epc' | 'conversionRate' | 'commission' | 'score';
}
