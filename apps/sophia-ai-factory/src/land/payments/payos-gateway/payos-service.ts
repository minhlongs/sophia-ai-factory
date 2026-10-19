import { FEATURE_PAYOS } from '@/seed/config/flags';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type {
  PayOsCheckoutInput,
  PayOsCheckoutResult,
  PayOsCreatePaymentResponse,
} from './types';
import { PayOsDefinitiveError } from './types';
import { getPayOsTierConfig } from './webhook-dispatcher';

export { FEATURE_PAYOS };

/**
 * Create a PayOS payment link with VND QR code.
 * Calls PayOS REST API v2 (https://api-merchant.payos.vn).
 * Requires PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY env vars.
 */
export async function createPayOsInvoice(input: PayOsCheckoutInput): Promise<PayOsCheckoutResult> {
  if (!FEATURE_PAYOS) {
    throw new PayOsDefinitiveError('PayOS feature flag disabled — set FEATURE_PAYOS=true to enable');
  }

  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

  if (!clientId || !apiKey || !checksumKey) {
    throw new PayOsDefinitiveError('PayOS env vars missing: PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY');
  }

  const { tier, userId: _userId, orderId, customerEmail } = input;
  const config = getPayOsTierConfig(tier, input.period);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

  // PayOS orderCode must be a positive integer — use last 9 digits of timestamp
  const orderCode = input.orderCodeOverride ?? parseInt(Date.now().toString().slice(-9), 10);
  const description = `Sophia ${tier} - ${orderId.slice(-8)}`;
  const expiredAt = Math.floor((Date.now() + 30 * 60 * 1000) / 1000); // 30 min

  const amount = input.amountVndOverride ?? config.vndAmount;

  const body = {
    orderCode,
    amount,
    description,
    buyerEmail: customerEmail,
    buyerName: undefined,
    returnUrl: `${appUrl}/payment-success?order_id=${orderId}&tier=${tier}`,
    cancelUrl: `${appUrl}/pricing`,
    expiredAt,
    items: [
      {
        name: `Sophia AI Factory ${tier}`,
        quantity: 1,
        price: amount,
      },
    ],
  };

  // Compute checksum: amount + cancelUrl + description + orderCode + returnUrl
  // Per PayOS API v2 docs
  const checksumData = [
    `amount=${body.amount}`,
    `cancelUrl=${body.cancelUrl}`,
    `description=${body.description}`,
    `orderCode=${body.orderCode}`,
    `returnUrl=${body.returnUrl}`,
  ].join('&');

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(checksumKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(checksumData));
  const checksum = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (!shouldAllowRequest('payos')) {
    throw new PayOsDefinitiveError('Circuit open for payos — too many recent failures');
  }

  try {
    const response = await fetch('https://api-merchant.payos.vn/v2/payment-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ ...body, signature: checksum }),
    });

    const result = (await response.json()) as PayOsCreatePaymentResponse;

    if (result.code !== '00' || !result.data) {
      throw new PayOsDefinitiveError(`PayOS API error: ${result.code} — ${result.desc}`);
    }

    recordSuccess('payos');

    return {
      qrUrl: result.data.qrCode,
      checkoutUrl: result.data.checkoutUrl,
      paymentLinkId: result.data.paymentLinkId,
      orderCode: result.data.orderCode,
      expiresAt: new Date(expiredAt * 1000).toISOString(),
    };
  } catch (error) {
    recordFailure('payos', classifyError(error));
    throw error;
  }
}
