/**
 * Co-Op Marketing & Payout Batch Types
 *
 * Layer: tree (pure domain types & contracts)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/types/coop-payout-types
 */

import type { PayoutRail } from './core-types';
export type {
  AuditCoOpClaimResult,
  PartnerCoOpClaim,
  PayoutBatchExecutionResult,
  SubmitCoOpClaimInput,
} from './coop-claim-types';

export type CoOpClaimType =
  | 'paid_ads'
  | 'influencer_sponsorship'
  | 'offline_event'
  | 'creative_production'
  | 'co_branded_content'
  | 'digital_ads'
  | 'event_sponsorship'
  | 'content_creation'
  | 'webinar'
  | 'print_media'
  | 'other';

export type CoOpClaimStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'paid'
  | 'disbursed'
  | 'cancelled';

export type BudgetAllocationStatus = 'active' | 'exhausted' | 'expired' | 'locked' | 'closed';

export type PayoutBatchType = 'commission' | 'co_op_reimbursement' | 'hybrid';

export type PayoutBatchStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Database Entity: Co-Op Budget Allocation
 */
export interface CoOpBudgetAllocation {
  id: string;
  partner_id: string;
  billing_cycle_month: string; // 'YYYY-MM'
  tier_at_time: 'GOLD' | 'PLATINUM';
  mrr_basis_cents: number;
  accrual_rate_pct: number;
  allocated_cents: number;
  claimed_cents: number;
  remaining_cents: number;
  expires_at: number;
  status: BudgetAllocationStatus;
  created_at: number;
  updated_at: number;
}

/**
 * Database Entity: Partner Payout Batch
 */
export interface PartnerPayoutBatch {
  id: string;
  partner_id: string | null;
  batch_type: PayoutBatchType;
  payout_rail: PayoutRail;
  total_amount_cents: number;
  currency: 'USD' | 'VND' | 'USDT';
  total_amount_local: number;
  fx_rate: number;
  item_count: number;
  destination_address: string | null;
  tx_hash: string | null;
  status: PayoutBatchStatus;
  external_reference: string | null;
  raw_response_json: string;
  error_message: string | null;
  executed_at: number | null;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}
