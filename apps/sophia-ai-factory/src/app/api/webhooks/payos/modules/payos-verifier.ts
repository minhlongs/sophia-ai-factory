import { NextRequest, NextResponse } from 'next/server';
import {
  verifyPayOsWebhook,
  payOsIpnSchema,
  FEATURE_PAYOS,
} from '@/land/payments/payos';
import { logger } from '@/seed/utils/logger-utility';

export interface VerifiedPayOsPayload {
  rawBody: string;
  sanitizedBody: string;
  ipn: ReturnType<typeof payOsIpnSchema.parse>;
}

export async function verifyPayOsRequest(
  request: NextRequest,
  checksumKey?: string,
): Promise<{ ok: true; data: VerifiedPayOsPayload } | { ok: false; response: NextResponse }> {
  if (!FEATURE_PAYOS) {
    logger.warn('[PayOS Webhook] Feature flag disabled — ignoring');
    return { ok: false, response: NextResponse.json({ received: true, note: 'payos_disabled' }, { status: 200 }) };
  }

  if (!checksumKey) {
    logger.error('[PayOS Webhook] PAYOS_CHECKSUM_KEY not configured');
    return { ok: false, response: NextResponse.json({ error: 'Configuration error' }, { status: 500 }) };
  }

  const rawBody = await request.text();
  try {
    const raw = JSON.parse(rawBody) as unknown;
    const parsed = payOsIpnSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn('[PayOS Webhook] Invalid payload shape', { errors: parsed.error.flatten() });
      return {
        ok: false,
        response: NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 }),
      };
    }
    // PayOS sends the HMAC in the JSON body's `signature` field.
    const isValid = await verifyPayOsWebhook(rawBody, parsed.data.signature, checksumKey);
    if (!isValid) {
      logger.warn('[PayOS Webhook] Invalid checksum signature');
      return { ok: false, response: NextResponse.json({ error: 'Invalid signature' }, { status: 400 }) };
    }

    const sanitizedBody = JSON.stringify(raw);
    return { ok: true, data: { rawBody, sanitizedBody, ipn: parsed.data } };
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) };
  }
}
