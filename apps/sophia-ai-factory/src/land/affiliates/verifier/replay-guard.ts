/**
 * replay-guard.ts — Land Layer
 * 14-day hold period calculation and anti-fraud safeguards
 */

import { HOLD_PERIOD_MS, type AntiFraudCheckInput, type AntiFraudCheckResult } from './types';

/**
 * Enforce exactly 14 days hold before commission eligibility.
 */
export function calculatePayableTimestamp(attributedAtMs: number = Date.now()): number {
  return attributedAtMs + HOLD_PERIOD_MS;
}

/**
 * Validate anti-fraud rules including self-referral and zero-amount safeguards.
 */
export function validateAntiFraudRules(input: AntiFraudCheckInput): AntiFraudCheckResult {
  const { partnerUserId, buyerUserId, buyerEmail, partnerEmail, orderAmountCents } = input;

  // Rule 1: Order amount must be a positive finite number (guards against NaN, Infinity, <= 0)
  if (
    typeof orderAmountCents !== 'number' ||
    Number.isNaN(orderAmountCents) ||
    !Number.isFinite(orderAmountCents) ||
    orderAmountCents <= 0
  ) {
    return {
      allowed: false,
      reason: 'INVALID_ORDER_AMOUNT: Order amount must be strictly greater than 0.',
    };
  }

  // Rule 2: Self-referral detection by user ID
  if (buyerUserId && partnerUserId && buyerUserId.trim() === partnerUserId.trim()) {
    return {
      allowed: false,
      reason: 'SELF_REFERRAL_DETECTED: Partner user ID matches buyer user ID.',
    };
  }

  // Rule 3: Self-referral detection by email address
  if (buyerEmail && partnerEmail && buyerEmail.trim().toLowerCase() === partnerEmail.trim().toLowerCase()) {
    return {
      allowed: false,
      reason: 'SELF_REFERRAL_DETECTED: Partner email matches buyer email.',
    };
  }

  return { allowed: true };
}
