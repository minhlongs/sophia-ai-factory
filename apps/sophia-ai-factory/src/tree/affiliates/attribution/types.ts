/**
 * Affiliate Attribution Types and Contracts
 * Layer: tree (domain business logic, edge-compatible)
 *
 * @module tree/affiliates/attribution/types
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  AffiliatePartnerRow,
  AffiliateReferralRow,
} from '@/seed/types/affiliate';

export type {
  AffiliateAttributionResult,
  AttributionParams,
  AffiliatePartnerRow,
  AffiliateReferralRow,
} from '@/seed/types/affiliate';

export const DEFAULT_HOLD_DAYS = 14;
export const DEFAULT_COMMISSION_RATE_PCT = 20.0;
export const DEFAULT_TIER2_RATE_PCT = 5.0;

export interface Tier2AttributionInput {
  d1: D1Database;
  partner: AffiliatePartnerRow;
  parentPartnerId: string;
  customerId?: string;
  grossAmountCents: number;
  referralId: string | null;
  provider: string;
  paymentId: string;
  orderId?: string | null;
  currency: string;
  holdDays: number;
  payableAt: number;
  primaryEventKey: string;
  nowMs: number;
}

export interface ReferrerResolution {
  partner: AffiliatePartnerRow | null;
  referral: AffiliateReferralRow | null;
}
