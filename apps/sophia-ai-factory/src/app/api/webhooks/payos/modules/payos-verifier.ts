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
  const signature = request.headers.get('x-checksum');
  if (!signature) {
    logger.warn('[PayOS Webhook] Missing x-checksum header');
    return { ok: false, response: NextResponse.json({ error: 'Missing signature' }, { status: 400 }) };
  }

  const isValid = await verifyPayOsWebhook(rawBody, signature, checksumKey);
  if (!isValid) {
    logger.warn('[PayOS Webhook] Invalid checksum signature');
    return { ok: false, response: NextResponse.json({ error: 'Invalid signature' }, { status: 400 }) };
  }

  try {
    const raw = JSON.parse(rawBody) as unknown;
    const sanitizedBody = JSON.stringify(raw);
    const parsed = payOsIpnSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn('[PayOS Webhook] Invalid payload shape', { errors: parsed.error.flatten() });
      return {
        ok: false,
        response: NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 }),
      };
    }
    return { ok: true, data: { rawBody, sanitizedBody, ipn: parsed.data } };
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) };
  }
}
