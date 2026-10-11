import { NextRequest } from 'next/server';
import { parseIpnWebhook } from '@/tree/clients/nowpayments-client';
import { ipnPayloadSchema, type IpnPayload } from '@/land/billing/ipn-payload-schema';
import { logger } from '@/seed/utils/logger-utility';

export const MAX_BODY_BYTES = 64 * 1024; // 64KB limit

function getCloudflareEnv(): Record<string, unknown> | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env) return env;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    return ctx?.env ?? null;
  } catch {
    return null;
  }
}

export function getNowPaymentsIpnSecret(): string | null {
  const env = getCloudflareEnv();
  const secret = env?.NOWPAYMENTS_IPN_SECRET;
  if (typeof secret === 'string') return secret;
  return process.env.NOWPAYMENTS_IPN_SECRET ?? null;
}

export type ParseBodyResult =
  | { success: true; rawBody: string }
  | { success: false; status: 400 | 413; error: string };

export async function readAndLimitRequestBody(request: NextRequest): Promise<ParseBodyResult> {
  try {
    const reader = request.body?.getReader();
    if (!reader) {
      return { success: true, rawBody: '' };
    }
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.byteLength;
      if (totalSize > MAX_BODY_BYTES) {
        logger.warn('[NOWPayments Webhook] Payload too large', { size: totalSize });
        return { success: false, status: 413, error: 'Payload too large (max 64KB)' };
      }
      chunks.push(value);
    }
    const rawBody = new TextDecoder().decode(
      chunks.reduce((acc, chunk) => {
        const merged = new Uint8Array(acc.byteLength + chunk.byteLength);
        merged.set(acc, 0);
        merged.set(chunk, acc.byteLength);
        return merged;
      }, new Uint8Array(0)),
    );
    return { success: true, rawBody };
  } catch {
    return { success: false, status: 400, error: 'Failed to read request body' };
  }
}

export type VerifySignatureResult =
  | { success: true; ipn: IpnPayload }
  | { success: false; status: 400; error: string };

export function verifyAndParseIpnPayload(
  rawBody: string,
  signature: string | null,
): VerifySignatureResult {
  if (!signature) {
    logger.warn('[NOWPayments Webhook] Missing x-nowpayments-sig header');
    return { success: false, status: 400, error: 'Missing signature' };
  }

  let rawPayload: Record<string, unknown>;
  try {
    rawPayload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { success: false, status: 400, error: 'Invalid JSON' };
  }

  let sdkResult: ReturnType<typeof parseIpnWebhook>;
  try {
    sdkResult = parseIpnWebhook(rawPayload, signature);
  } catch (err) {
    logger.warn('[NOWPayments Webhook] SDK verification failed', { error: String(err) });
    return { success: false, status: 400, error: 'Invalid signature' };
  }

  const parsed = ipnPayloadSchema.safeParse(sdkResult);
  if (!parsed.success) {
    logger.warn('[NOWPayments Webhook] Invalid payload shape', { errors: parsed.error.flatten() });
    return { success: false, status: 400, error: 'Invalid payload' };
  }

  return { success: true, ipn: parsed.data };
}
