import type { Tier } from '@/seed/types';

export interface ChangeTierResult {
  newTier: Tier;
  proratedAmount: number;
  effectiveDate: string;
}

export type BillingErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NO_ACTIVE_SUBSCRIPTION'
  | 'SUBSCRIPTION_NOT_ACTIVE'
  | 'ALREADY_ON_TIER'
  | 'IN_DUNNING'
  | 'MASTER_REQUIRES_SEPARATE_FLOW'
  | 'UPGRADE_REQUIRES_PAYMENT'
  | 'DB_ERROR'
  | 'INVALID_TIER'
  | 'GRACE_PERIOD_EXPIRED';

export interface BillingError {
  code: BillingErrorCode;
  message: string;
}

export interface SubscriptionRow {
  id: string;
  org_id: string;
  plan: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end?: number;
  cancellation_date?: string | null;
}

export interface ChangeTierOptions {
  /** Bypass dunning cache check (e.g. immediately returning from successful checkout redirect) */
  bypassDunningCache?: boolean;
}
