/**
 * Types and Interfaces for Dual-Entry Commission Accounting Ledger
 *
 * @module tree/affiliate/ledger/types
 */

export type CommissionLedgerStatus =
  | 'pending'
  | 'payable'
  | 'paying'
  | 'paid'
  | 'clawback'
  | 'clawed_back';

export type AffiliateNetwork =
  | 'tiktok_shop'
  | 'amazon_associates'
  | 'amazon'
  | 'clickbank'
  | 'accesstrade'
  | 'awin'
  | (string & {});

export interface CommissionEntryInput {
  id?: string;
  affiliateId: string;
  network: AffiliateNetwork;
  externalConversionId: string;
  subId?: string | null;
  orderValueCents: number;
  commissionCents: number;
  holdDays?: number; // defaults to 14
  attributedAt?: number; // defaults to Date.now()
  payableAt?: number; // defaults to attributedAt + holdDays * 86400000
}

export interface CommissionEntryResult {
  success: boolean;
  ledgerId: string;
  affiliateId: string;
  commissionCents: number;
  payableAt: number;
  network: string;
  duplicate?: boolean;
  error?: string;
}

export interface ClawbackAdjustmentInput {
  parentConversionId: string;
  refundCents: number;
  reason?: string;
  nowMs?: number;
}

export interface LedgerAdjustmentResult {
  success: boolean;
  adjustmentId?: string;
  amountCents: number; // negative value (-refundCents)
  status: 'clawback' | 'clawed_back';
  parentConversionId: string;
  error?: string;
}

export interface NetBalanceResult {
  affiliateId: string;
  totalCommissionsCents: number;
  totalClawbacksCents: number;
  netCents: number;
  pendingCents: number;
  payableCents: number;
  paidCents: number;
}
