/**
 * Manual Pilot Settlement & Refund Types and Zod Schemas (G3).
 * Layer: land/payments/manual-pilot
 */

import { z } from 'zod';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';

export type ManualPilotStatus =
  | 'pending_manual_payment'
  | 'under_review'
  | 'activated'
  | 'rejected'
  | 'refund_pending'
  | 'refunded';

export type BankEvidenceLevel =
  | 'UNTRUSTED_CUSTOMER_CLAIM'
  | 'BANK_RECORD_RECEIVED'
  | 'BANK_RECORD_INDEPENDENTLY_CHECKED'
  | 'AUTHORIZED_RECONCILIATION'
  | 'SETTLED_ORDER';

/** Always OPERATOR_VERIFIED_BANK_RECORD for manual inspection; never BANK_API_VERIFIED. */
export type BankVerificationBasis = 'OPERATOR_VERIFIED_BANK_RECORD';

export type EmailReceiptReviewState =
  | 'RECEIVED_UNVERIFIED'
  | 'RECEIPT_EVIDENCE_ATTACHED'
  | 'RECEIPT_VERIFIED'
  | 'ELIGIBILITY_ASSESSED';

export type EmailEligibilityOutcome =
  | 'PENDING_MANUAL_REVIEW'
  | 'ELIGIBLE_TIMELY'
  | 'INELIGIBLE_OUTSIDE_WINDOW'
  | 'INELIGIBLE_MISSING_DELIVERY_EVIDENCE';

export type ManualPilotAuditAction =
  | 'created'
  | 'approved_and_activated'
  | 'duplicate_rejected'
  | 'rejected'
  | 'refund_requested'
  | 'refund_confirmed';

export interface ManualPilotSettlement {
  id: string;
  order_id: string;
  user_id: string;
  org_id: string | null;
  sku_code: string;
  expected_amount_vnd: number;
  received_amount_vnd: number | null;
  transfer_reference: string;
  bank_transaction_ref: string | null;
  payer_note: string | null;
  status: ManualPilotStatus;
  reconciled_by_admin_id: string | null;
  reconciled_at: string | null;
  activated_at: string | null;
  entitlement_period_end: string | null;
  granted_mcu: number;
  idempotency_key: string | null;
  refund_id: string | null;
  refund_amount_vnd: number | null;
  refund_reason: string | null;
  refund_external_ref: string | null;
  refund_requested_by: string | null;
  refund_requested_at: string | null;
  refund_confirmed_by: string | null;
  refund_confirmed_at: string | null;
  audit_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManualPilotError {
  code:
    | 'NOT_FOUND'
    | 'DUPLICATE_SETTLEMENT'
    | 'DUPLICATE_BANK_REF'
    | 'AMOUNT_MISMATCH'
    | 'INVALID_STATE'
    | 'REFUND_WINDOW_EXCEEDED'
    | 'VALIDATION_ERROR'
    | 'DB_ERROR';
  message: string;
}

export const reconcileManualPilotSchema = z.object({
  action: z.enum(['approve_and_activate', 'reject', 'verify_settlement', 'reconcile', 'approve']),
  evidenceId: z.string().min(1).max(128).optional(),
  orderId: z.string().min(3).max(128),
  receivedAmountVnd: z.number().int().positive().optional(),
  bankTransactionRef: z.string().min(3).max(128).optional(),
  payerNote: z.string().max(500).optional(),
  auditNotes: z.string().max(1000).optional(),
});

export type ReconcileManualPilotInput = z.infer<typeof reconcileManualPilotSchema>;

export const manualPilotRefundRequestSchema = z.object({
  action: z.literal('request'),
  intakeId: z.string().min(1).max(128).optional(),
  orderId: z.string().min(3).max(128),
  reason: z.string().min(5).max(500),
  category: z.enum(['goodwill_7d', 'delivery_failure_14d']),
  refundAmountVnd: z
    .number()
    .int()
    .positive()
    .max(OPTION_A_PILOT_CONTRACT.priceVnd)
    .default(OPTION_A_PILOT_CONTRACT.priceVnd),
  auditNotes: z.string().max(1000).optional(),
});

export const manualPilotRefundConfirmSchema = z.object({
  action: z.literal('confirm'),
  orderId: z.string().min(3).max(128),
  refundExternalRef: z.string().min(3).max(128),
  auditNotes: z.string().max(1000).optional(),
});

export const manualPilotRefundSchema = z.discriminatedUnion('action', [
  manualPilotRefundRequestSchema,
  manualPilotRefundConfirmSchema,
  z.object({action:z.literal('approve'),orderId:z.string().min(3).max(128)}),
  z.object({action:z.literal('transfer_pending'),orderId:z.string().min(3).max(128)}),
  z.object({action:z.literal('settle'),orderId:z.string().min(3).max(128),evidenceId:z.string().min(1).max(128)}),
]);

export type ManualPilotRefundInput = z.infer<typeof manualPilotRefundSchema>;
