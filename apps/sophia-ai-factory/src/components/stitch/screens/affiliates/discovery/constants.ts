import type { SortOptionItem } from './types';

export const CATEGORIES = [
  { id: 'all', key: 'all' },
  { id: 'SaaS', key: 'saas' },
  { id: 'E-Commerce', key: 'ecommerce' },
  { id: 'Creator Tools', key: 'creatorTools' },
  { id: 'Agency Automation', key: 'agencyAutomation' },
] as const;

export const PAYOUT_MODELS = [
  { id: 'all', key: 'all' },
  { id: 'RevShare %', key: 'revshare' },
  { id: 'Flat CPA', key: 'cpa' },
  { id: 'Recurring', key: 'recurring' },
] as const;

export const SORT_OPTIONS: readonly SortOptionItem[] = [
  { id: 'epc', key: 'epc' },
  { id: 'conversion', key: 'conversionRate' },
  { id: 'commission', key: 'commission' },
  { id: 'quality', key: 'score' },
] as const;
