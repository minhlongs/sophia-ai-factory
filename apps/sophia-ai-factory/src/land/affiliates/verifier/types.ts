/**
 * Affiliate Webhook Verifier Types
 * Layer: Land (Affiliates)
 */

import type { HmacAlgorithm } from '@/tree/affiliate/hmac-verifier';

export const HOLD_PERIOD_DAYS = 14;
export const HOLD_PERIOD_MS = 14 * 86400 * 1000; // Exactly 14 days in milliseconds

export interface VerifySignatureOptions {
  rawBody: string;
  signature: string;
  secret: string;
  algorithm?: HmacAlgorithm;
}

export interface AntiFraudCheckInput {
  partnerUserId: string;
  buyerUserId?: string;
  buyerEmail?: string;
  partnerEmail?: string;
  orderAmountCents: number;
}

export interface AntiFraudCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface CommissionWebhookPayload {
  conversionEventId: string;
  partnerCode: string;
  orderAmountCents: number;
  buyerUserId?: string;
  buyerEmail?: string;
  offerId?: string;
  tenantId?: string;
  timestamp?: number;
}

export interface CommissionLedgerEntry {
  ledgerId: string;
  affiliateId: string;
  partnerCode: string;
  tier: string;
  ratePct: number;
  commissionCents: number;
  payableAt: number;
  status: 'pending';
  isTier2: boolean;
}

export interface AffiliateCommissionLedgerResult {
  success: boolean;
  error?: string;
  fraudDetected?: boolean;
  entries?: CommissionLedgerEntry[];
}
