/**
 * Affiliate Ledger Submodule: Types.
 * Layer: tree (domain reusable; imports from @/seed)
 *
 * @module tree/affiliates/ledger/types
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { CommissionStatus, PayoutRail } from '@/seed/types/affiliate';

export interface RawPartnerStatsRow {
  total_partners: number;
  active_partners: number;
}

export interface RawCommissionStatsRow {
  total_comm: number | null;
  pending_comm: number | null;
  settled_comm: number | null;
}

export interface RawPartnerActivityRow {
  total_referrals: number;
  converted_referrals: number;
  total_earnings_cents: number;
  pending_payout_cents: number;
  settled_payout_cents: number;
}

export interface PartnerLedgerStatsResult {
  partnerId: string;
  totalEarningsCents: number;
  pendingPayoutCents: number;
  settledPayoutCents: number;
  totalReferrals: number;
  convertedReferrals: number;
  conversionRatePct: number;
}

export interface CreatePayoutInput {
  partnerId: string;
  rail: PayoutRail;
  amountCents: number;
  currency?: string;
  destinationEncrypted: string;
  d1?: D1Database;
}

export interface PayoutMutationResult {
  success: boolean;
  payoutId?: string;
  payoutReference?: string;
  newVersion?: number;
  conflict?: boolean;
  error?: string;
}

export interface ApprovePayoutInput {
  payoutId: string;
  currentVersion: number;
  approvedBy: string;
  d1?: D1Database;
}

export interface CompletePayoutInput {
  payoutId: string;
  currentVersion: number;
  txHashOrBankRef: string;
  d1?: D1Database;
}

export interface UpdateCommissionOccInput {
  commissionId: string;
  currentVersion: number;
  targetStatus: CommissionStatus;
  payoutId?: string | null;
  d1?: D1Database;
}

export interface AffiliateOffersQueryOptions {
  category?: string;
  payoutModel?: string;
  search?: string;
  sortBy?: 'epc' | 'conversion' | 'commission' | 'quality';
  limit?: number;
  offset?: number;
}
