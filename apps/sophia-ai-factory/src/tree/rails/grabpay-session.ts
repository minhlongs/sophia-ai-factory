/**
 * GrabPay Checkout Session Adapter
 *
 * Layer: tree/rails (Pure domain service — imports only from seed)
 *
 * @module tree/rails/grabpay-session
 */

import type { GrabPaySession } from '@/seed/types/localized-rails';
import type { SupportedCurrency } from '@/seed/types/enterprise-billing';

const DEFAULT_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes TTL

export interface CreateGrabPaySessionInput {
  orgId: string;
  userId: string;
  amount: number;
  currency: SupportedCurrency;
  redirectUrl?: string;
  idempotencyKey?: string;
}

/**
 * Creates a GrabPay checkout session adapter.
 */
export function createGrabPaySession(input: CreateGrabPaySessionInput): GrabPaySession {
  const { amount, currency } = input;

  if (amount <= 0) {
    throw new Error(`GrabPay amount must be greater than zero: ${amount}`);
  }

  const sessionId = `grab_sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  const expiresAt = Date.now() + DEFAULT_EXPIRY_MS;
  const redirectBase = input.redirectUrl ?? 'https://sophia.agencyos.network/checkout/complete';
  const checkoutUrl = `https://pay.grab.com/v2/checkout?session=${sessionId}&redirect=${encodeURIComponent(redirectBase)}`;

  return {
    sessionId,
    checkoutUrl,
    paymentStatus: 'created',
    amount,
    currency,
    expiresAt,
  };
}
