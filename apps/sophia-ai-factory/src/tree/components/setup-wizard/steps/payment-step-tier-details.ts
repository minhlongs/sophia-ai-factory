import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';

export type TierType = Tier;

export interface TierDetailInfo {
  name: string;
  mcuMonthly: number;
  price: number;
  billingType: 'monthly' | 'lifetime';
}

function getTierDetails(tier: TierType): TierDetailInfo {
  const canonical = UNIFIED_TIERS[tier];
  return {
    name: canonical.name,
    mcuMonthly: canonical.mcuMonthly,
    price: canonical.price,
    billingType: canonical.billingType,
  };
}

export const TIER_DETAILS: Record<TierType, TierDetailInfo> = {
  BASIC: getTierDetails('BASIC'),
  PREMIUM: getTierDetails('PREMIUM'),
  ENTERPRISE: getTierDetails('ENTERPRISE'),
  MASTER: getTierDetails('MASTER'),
};

export interface PaymentCardsGridProps {
  details: TierDetailInfo;
  subscriptionStatus: string;
  renewalDate?: string;
  mcuBalance?: number;
}
