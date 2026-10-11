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
  { id: 'basic', popular: false, monthlyPrice: 29, yearlyPrice: 23, featureCount: 3 },
  { id: 'premium', popular: true, monthlyPrice: 79, yearlyPrice: 63, featureCount: 4 },
  { id: 'enterprise', popular: false, monthlyPrice: 199, yearlyPrice: 159, featureCount: 4 },
  { id: 'master', popular: false, monthlyPrice: null, yearlyPrice: null, featureCount: 3 },
];

export const FAQ_INDICES = [0, 1, 2, 3] as const;
