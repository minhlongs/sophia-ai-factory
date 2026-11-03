/**
 * Cloudflare Edge Web Crypto HMAC-SHA256 Signer & Verifier for External Mekong Pull-Workers (Supreme #02.2 R3)
 * Authenticates `x-mekong-signature` (`HMAC-SHA256` over `${timestamp}.${rawBody}`) and `x-mekong-timestamp`
 * with a 300-second anti-replay window and constant-time comparison (`timingSafeEqual`).
 * Layer: tree/mekong/crypto (imports seed only)
 */

import { timingSafeEqual } from '@/seed/security/csrf-helpers';
import { success, failure, type Result } from '@/seed/types/result';

export const MEKONG_SIGNATURE_HEADER = 'x-mekong-signature' as const;
export const MEKONG_TIMESTAMP_HEADER = 'x-mekong-timestamp' as const;
export const MEKONG_HMAC_MAX_SKEW_SECONDS = 300;

export interface VerifyMekongWorkerHmacInput {
  secret: string | undefined;
  signatureHeader: string | null;
  timestampHeader: string | null;
  rawBody: string;
  nowMs?: number;
  maxSkewSec?: number;
}

export interface MekongWorkerHmacError {
  code: 'WORKER_SECRET_NOT_CONFIGURED' | 'MISSING_HMAC_HEADERS' | 'HMAC_TIMESTAMP_EXPIRED' | 'INVALID_HMAC_SIGNATURE';
  message: string;
  status: 401 | 503;
}

export async function signMekongWorkerPayload(
  secret: string,
  timestampSec: number | string,
  rawBody: string
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const macBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestampSec}.${rawBody}`));
  return Array.from(new Uint8Array(macBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyMekongWorkerHmac(
  input: VerifyMekongWorkerHmacInput
): Promise<Result<{ verified: true; timestampSec: number }, MekongWorkerHmacError>> {
  const secret = input.secret?.trim();
  if (!secret) {
    return failure({
      code: 'WORKER_SECRET_NOT_CONFIGURED',
      message: 'MEKONG_WORKER_SHARED_SECRET is not configured on Edge runtime',
      status: 503,
    });
  }
  if (!input.signatureHeader || !input.timestampHeader) {
    return failure({
      code: 'MISSING_HMAC_HEADERS',
      message: 'Missing x-mekong-signature or x-mekong-timestamp header',
      status: 401,
    });
  }
  if (!/^\d+$/.test(input.timestampHeader.trim())) {
    return failure({
      code: 'HMAC_TIMESTAMP_EXPIRED',
      message: 'Invalid non-numeric x-mekong-timestamp header',
      status: 401,
    });
  }
  const timestampSec = Number(input.timestampHeader.trim());
  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const maxSkewSec = input.maxSkewSec ?? MEKONG_HMAC_MAX_SKEW_SECONDS;
  if (Math.abs(nowSec - timestampSec) > maxSkewSec) {
    return failure({
      code: 'HMAC_TIMESTAMP_EXPIRED',
      message: `Worker timestamp ${timestampSec} outside ${maxSkewSec}s anti-replay window (now=${nowSec})`,
      status: 401,
    });
  }
  const normalizedCandidate = input.signatureHeader.trim().replace(/^sha256=/i, '').toLowerCase();
  const expectedHex = await signMekongWorkerPayload(secret, timestampSec, input.rawBody);
  if (!timingSafeEqual(normalizedCandidate, expectedHex)) {
    return failure({
      code: 'INVALID_HMAC_SIGNATURE',
      message: 'Worker HMAC-SHA256 signature verification failed',
      status: 401,
    });
  }
  return success({ verified: true, timestampSec });
}
