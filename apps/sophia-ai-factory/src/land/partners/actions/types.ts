/**
 * Co-Op & Payout Server Action Types & Contracts
 *
 * Layer: land
 *
 * @module land/partners/actions/types
 */

import type {
  PartnerTier,
  CoOpClaimType,
  PayoutBatchType,
  PayoutRail,
} from '@/tree/partners/types';
import type { InvoiceAppraisalInput } from '@/tree/partners/co-op-engine';

export interface CoOpActionError {
  code: string;
  message: string;
}

export interface AccrueBudgetActionInput {
  partnerId: string;
  cycleMonth: string;
  mrrCents: number;
  tier?: PartnerTier;
}

export interface SubmitClaimActionInput {
  partnerId: string;
  campaignName: string;
  claimType: CoOpClaimType;
  invoiceNumber: string;
  invoiceUrl: string;
  invoiceDate: number;
  requestedAmountCents: number;
  reimbursementCurrency?: 'USDT' | 'VND';
  vendorName?: string;
  brandKeywords?: string[];
  periodStart?: number;
  periodEnd?: number;
  notes?: string;
}

export interface CreatePayoutBatchActionInput {
  partnerId?: string;
  batchType: PayoutBatchType;
  rail: PayoutRail;
  currency?: 'USD' | 'VND' | 'USDT';
  fxRate?: number;
  destinationAddress?: string;
}

export interface AuditClaimActionInput extends InvoiceAppraisalInput {
  partnerId?: string;
}

export interface PartnerOwnershipRecord {
  id: string;
  user_id: string;
}

export type PartnerOwnershipResult =
  | { ok: true; success: true; value: PartnerOwnershipRecord }
  | { ok: false; success: false; error: CoOpActionError };
