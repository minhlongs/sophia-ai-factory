import { payOsIpnSchema, verifyPayOsWebhook } from '@/land/payments/payos';
import { logger } from '@/seed/utils/logger-utility';

export interface ValidatedIpnRequest {
  rawBody: string;
  bodyJson: unknown;
  ipnData: {
    orderCode: number | string;
    amount: number;
    description: string;
    paymentLinkId: string;
  };
  signature: string;
  success: boolean;
}

export async function validatePayOsRequest(
  request: Request,
  checksumKey: string
): Promise<{ ok: true; data: ValidatedIpnRequest } | { ok: false; error: string; status: number }> {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return { ok: false, error: 'Failed to read body', status: 400 };
  }

  let bodyJson: unknown;
  try {
    bodyJson = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: 'Invalid JSON', status: 400 };
  }

  const parsed = payOsIpnSchema.safeParse(bodyJson);
  if (!parsed.success) {
    logger.warn('[PayOS IPN] Invalid payload shape', { errors: parsed.error.flatten() });
    return { ok: false, error: 'Invalid payload', status: 400 };
  }

  const { data: ipnData, signature, success } = parsed.data;
  const { orderCode } = ipnData;

  const isValid = await verifyPayOsWebhook(rawBody, signature, checksumKey);
  if (!isValid) {
    logger.warn('[PayOS IPN] Invalid signature', { orderCode });
    return { ok: false, error: 'Invalid signature', status: 401 };
  }

  const eventTimestamp =
    ((bodyJson as Record<string, unknown>)?.data as Record<string, unknown> | undefined)?.timestamp ??
    ((bodyJson as Record<string, unknown>)?.timestamp as number | undefined);
  if (eventTimestamp && typeof eventTimestamp === 'number') {
    const age = Math.abs(Math.floor(Date.now() / 1000) - eventTimestamp);
    if (age > 300) {
      return { ok: false, error: 'REPLAY_DETECTED', status: 400 };
    }
  }

  return {
    ok: true,
    data: {
      rawBody,
      bodyJson,
      ipnData,
      signature,
      success,
    },
  };
}
