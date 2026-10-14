import type { Tier } from '@/seed/types';

export const TIER_RANK: Record<string, number> = {
  BASIC: 1,
  PREMIUM: 2,
  ENTERPRISE: 3,
  MASTER: 4,
};

export interface ProvisionResult {
  success: boolean;
  error?: string;
  creditCents?: number;
  effectiveAt?: string;
}

export interface SubscriptionRow {
  id: string;
  org_id: string;
  plan: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
}

export interface ProvisionTierChangeParams {
  userId: string;
  orgId: string;
  currentTier: Tier;
  targetTier: Tier;
  timing: 'immediate' | 'end_of_cycle';
}
