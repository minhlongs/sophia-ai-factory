/**
 * Webhook signature verification and IPN payload parsing.
 *
 * @module tree/clients/nowpayments/ipn-verifier
 */

import type { Payment as SdkPayment } from '@nowpaymentsio/nowpayments-sdk-nodejs';
import { verifyInboundWebhook } from '@/seed/security/signature';
import type { IpnPayloadResult } from './types';
import { createNowPaymentsSDK } from './nowpayments-client';

/**
 * Map SDK Payment event to internal IPN payload shape.
 * Falls back to rawPayload for fields the SDK Payment may not include
 * (customer_email, actually_paid_at_fiat, outcome_currency).
 */
export function sdkEventToInternalPayload(
  event: { type: string; payment: SdkPayment },
  rawPayload: Record<string, unknown>,
): IpnPayloadResult {
  const p = event.payment;
  return {
    payment_id: String(p.payment_id ?? rawPayload.payment_id ?? ''),
    payment_status: p.payment_status ?? 'waiting',
    pay_address: (p.pay_address ?? undefined) as string | undefined,
    price_amount: Number(p.price_amount ?? rawPayload.price_amount ?? 0),
    price_currency: String(p.price_currency ?? rawPayload.price_currency ?? 'USD'),
    pay_amount: p.pay_amount != null ? Number(p.pay_amount) : undefined,
    pay_currency: (p.pay_currency ?? undefined) as string | undefined,
    order_id: (p.order_id ?? undefined) as string | undefined,
    order_description: (p.order_description ?? undefined) as string | undefined,
    invoice_id: (p.invoice_id ?? rawPayload.invoice_id) as string | undefined,
    actually_paid:
      p.actually_paid != null
        ? Number(p.actually_paid)
        : rawPayload.actually_paid != null
          ? Number(rawPayload.actually_paid)
          : undefined,
    outcome_amount:
      p.outcome_amount != null
        ? Number(p.outcome_amount)
        : rawPayload.outcome_amount != null
          ? Number(rawPayload.outcome_amount)
          : undefined,
    outcome_currency: (p.outcome_currency ?? rawPayload.outcome_currency) as string | undefined,
    customer_email: (rawPayload.customer_email ?? undefined) as string | undefined,
  };
}

/**
 * Parse and verify a NOWPayments IPN webhook using the SDK.
 *
 * @throws {Error} if signature verification fails or event type is unexpected
 */
export function parseIpnWebhook(
  payload: Record<string, unknown>,
  signature: string,
): IpnPayloadResult {
  const sdk = createNowPaymentsSDK();
  const event = sdk.parseWebhook(payload, signature, { verify: true });
  if (event.type !== 'payment.status_changed') {
    throw new Error(`Unexpected webhook event type: ${event.type}`);
  }
  return sdkEventToInternalPayload(event, payload);
}

function nowPaymentsCanonicalize(rawBody: string): string {
  const parsed = JSON.parse(rawBody) as Record<string, unknown>;
  return JSON.stringify(parsed, Object.keys(parsed).sort());
}

/**
 * Verify NOWPayments IPN signature using HMAC-SHA512.
 * KEPT because the payout webhook route still uses this function.
 */
export async function verifyIpnSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  return verifyInboundWebhook(rawBody, signature, secret, {
    algo: 'SHA-512',
    canonicalize: nowPaymentsCanonicalize,
  });
}
