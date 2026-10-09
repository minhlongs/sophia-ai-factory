/**
 * Co-Op Marketing & Payout Batch Types
 *
 * Layer: tree (pure domain types & contracts)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/types/coop-payout-types
 */

import type { PayoutRail } from './core-types';

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

/**
 * Database Entity: Partner Co-Op Claim
 */
export interface PartnerCoOpClaim {
  id: string;
  partner_id: string;
  budget_allocation_id: string | null;
  campaign_name: string;
  claim_type: CoOpClaimType;
  invoice_number: string;
  invoice_url: string;
  invoice_date: number;
  requested_amount_cents: number;
  approved_amount_cents: number;
  reimbursement_currency: 'USDT' | 'VND';
  status: CoOpClaimStatus;
  audit_score: number;
  audit_notes_json: string;
  rejection_reason: string | null;
  payout_batch_id: string | null;
  reviewed_by: string | null;
  reviewed_at: number | null;
  paid_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface SubmitCoOpClaimInput {
  partnerId: string;
  campaignName: string;
  claimType: CoOpClaimType;
  invoiceNumber: string;
  invoiceUrl: string;
  invoiceDate: number;
  requestedAmountCents: number;
  reimbursementCurrency: 'USDT' | 'VND';
}

export interface AuditCoOpClaimResult {
  claimId: string;
  auditScore: number;
  isAutoApproved: boolean;
  approvedAmountCents: number;
  breakdown: {
    vendorVerified: boolean;
    dateValid: boolean;
    proofProvided: boolean;
    budgetSufficient: boolean;
  };
  notes: string[];
}

export interface PayoutBatchExecutionResult {
  batchId: string;
  success: boolean;
  payoutRail: PayoutRail;
  totalAmountCents: number;
  totalAmountLocal: number;
  itemCount: number;
  externalReference?: string;
  status?: PayoutBatchStatus;
  txHash?: string;
  error?: string;
}
