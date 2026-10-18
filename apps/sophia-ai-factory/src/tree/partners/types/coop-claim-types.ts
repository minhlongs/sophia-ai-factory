/**
 * Co-Op Marketing Claim & Batch Execution Result Types
 *
 * Layer: tree (pure domain types & contracts)
 *
 * @module tree/partners/types/coop-claim-types
 */

import type { PayoutRail } from './core-types';
import type {
  CoOpClaimStatus,
  CoOpClaimType,
  PayoutBatchStatus,
} from './coop-payout-types';

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
