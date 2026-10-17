import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';

export type BillingPeriod = 'monthly' | 'yearly';
export type TierId = 'basic' | 'premium' | 'enterprise' | 'master';

export interface PricingTier {
  id: TierId;
  popular: boolean;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  featureCount: number;
}

export const TIERS: PricingTier[] = [
  {
    id: 'basic',
    popular: false,
    monthlyPrice: UNIFIED_TIERS.BASIC.price,
    yearlyPrice: UNIFIED_TIERS.BASIC.yearlyPrice,
    featureCount: 3,
  },
  {
    id: 'premium',
    popular: true,
    monthlyPrice: UNIFIED_TIERS.PREMIUM.price,
    yearlyPrice: UNIFIED_TIERS.PREMIUM.yearlyPrice,
    featureCount: 4,
  },
  {
    id: 'enterprise',
    popular: false,
    monthlyPrice: UNIFIED_TIERS.ENTERPRISE.price,
    yearlyPrice: UNIFIED_TIERS.ENTERPRISE.yearlyPrice,
    featureCount: 4,
  },
  { id: 'master', popular: false, monthlyPrice: null, yearlyPrice: null, featureCount: 3 },
];

export const FAQ_INDICES = [0, 1, 2, 3] as const;
