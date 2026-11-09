/**
 * SEC-07: Affiliate Self-Referral Fraud Detection & 30-Day Commission Escrow Hold Guard
 *
 * Blocks self-referral commissions (matching user IDs, normalized emails, or IP/device
 * fingerprints) and enforces a mandatory 30-day `ESCROW_HOLD` window before payout
 * eligibility so refunded/clawed-back purchases never drain platform treasury.
 *
 * Layer: tree (domain reusable logic)
 * @module tree/affiliate/fraud/affiliate-escrow-guard
 */

export const AFFILIATE_ESCROW_HOLD_DAYS = 30;
export const AFFILIATE_ESCROW_HOLD_MS = AFFILIATE_ESCROW_HOLD_DAYS * 24 * 60 * 60 * 1000;

export type CommissionEscrowStatus = 'ESCROW_HOLD' | 'ELIGIBLE' | 'VOIDED_SELF_REFERRAL' | 'VOIDED_REFUND';

export interface SelfReferralCheckInput {
  readonly affiliateUserId: string;
  readonly buyerUserId: string;
  readonly affiliateEmail?: string;
  readonly buyerEmail?: string;
  readonly affiliateIpHash?: string;
  readonly buyerIpHash?: string;
  readonly affiliatePaymentWallet?: string;
  readonly buyerPaymentWallet?: string;
}

export interface SelfReferralCheckResult {
  readonly isSelfReferral: boolean;
  readonly reason?:
    | 'SAME_USER_ID'
    | 'SAME_NORMALIZED_EMAIL'
    | 'SAME_IP_FINGERPRINT'
    | 'SAME_PAYMENT_WALLET';
}

function normalizeEmailForFraudCheck(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const [local, domain] = trimmed.split('@');
  if (!local || !domain) return trimmed;
  // Strip plus-addressing aliases (e.g. ceo+ref@domain.com -> ceo@domain.com)
  const baseLocal = local.split('+')[0].replace(/\./g, '');
  return `${baseLocal}@${domain}`;
}

/**
 * Detects affiliate self-referral attempts across account IDs, normalized emails,
 * IP fingerprints, and payout/payment wallets.
 */
export function detectSelfReferral(input: SelfReferralCheckInput): SelfReferralCheckResult {
  const affiliateUserId = input.affiliateUserId?.trim() ?? '';
  const buyerUserId = input.buyerUserId?.trim() ?? '';
  if (affiliateUserId.length > 0 && buyerUserId.length > 0 && affiliateUserId === buyerUserId) {
    return { isSelfReferral: true, reason: 'SAME_USER_ID' };
  }

  if (input.affiliateEmail && input.buyerEmail) {
    if (
      normalizeEmailForFraudCheck(input.affiliateEmail) ===
      normalizeEmailForFraudCheck(input.buyerEmail)
    ) {
      return { isSelfReferral: true, reason: 'SAME_NORMALIZED_EMAIL' };
    }
  }

  if (
    input.affiliateIpHash &&
    input.buyerIpHash &&
    input.affiliateIpHash.trim().length > 0 &&
    input.affiliateIpHash.trim() === input.buyerIpHash.trim()
  ) {
    return { isSelfReferral: true, reason: 'SAME_IP_FINGERPRINT' };
  }

  if (
    input.affiliatePaymentWallet &&
    input.buyerPaymentWallet &&
    input.affiliatePaymentWallet.trim().length > 0 &&
    input.affiliatePaymentWallet.trim().toLowerCase() ===
      input.buyerPaymentWallet.trim().toLowerCase()
  ) {
    return { isSelfReferral: true, reason: 'SAME_PAYMENT_WALLET' };
  }

  return { isSelfReferral: false };
}

export interface EscrowEvaluationInput {
  readonly conversionTimestampMs: number;
  readonly nowTimestampMs?: number;
  readonly isRefundedOrChargedback?: boolean;
  readonly selfReferralCheck?: SelfReferralCheckInput;
}

export interface EscrowEvaluationResult {
  readonly status: CommissionEscrowStatus;
  readonly eligibleForPayout: boolean;
  readonly releaseAtTimestampMs: number;
  readonly remainingHoldMs: number;
  readonly reason?: string;
}

/**
 * Evaluates whether a conversion commission must remain in `ESCROW_HOLD`,
 * be voided for refund/self-referral, or graduate to `ELIGIBLE` after 30 days.
 */
export function evaluateCommissionEscrowEligibility(
  input: EscrowEvaluationInput,
): EscrowEvaluationResult {
  const nowMs = input.nowTimestampMs ?? Date.now();
  const releaseAtTimestampMs = input.conversionTimestampMs + AFFILIATE_ESCROW_HOLD_MS;

  if (input.selfReferralCheck) {
    const fraud = detectSelfReferral(input.selfReferralCheck);
    if (fraud.isSelfReferral) {
      return {
        status: 'VOIDED_SELF_REFERRAL',
        eligibleForPayout: false,
        releaseAtTimestampMs,
        remainingHoldMs: 0,
        reason: fraud.reason,
      };
    }
  }

  if (input.isRefundedOrChargedback) {
    return {
      status: 'VOIDED_REFUND',
      eligibleForPayout: false,
      releaseAtTimestampMs,
      remainingHoldMs: 0,
      reason: 'CONVERSION_REFUNDED_OR_CHARGEDBACK',
    };
  }

  const remainingHoldMs = Math.max(0, releaseAtTimestampMs - nowMs);
  if (remainingHoldMs > 0) {
    return {
      status: 'ESCROW_HOLD',
      eligibleForPayout: false,
      releaseAtTimestampMs,
      remainingHoldMs,
      reason: 'HOLD_WINDOW_ACTIVE_30D',
    };
  }

  return {
    status: 'ELIGIBLE',
    eligibleForPayout: true,
    releaseAtTimestampMs,
    remainingHoldMs: 0,
  };
}
