import type { NextRequest } from 'next/server';
import {
  verifyHmacSha256Hex,
  verifyHmacSha256Base64,
  computeHmacSha256Hex,
} from '@/land/postback/hmac-verifier';
import { resolveNetworkSecret } from '@/land/postback/network-secret-resolver';
import { logger } from '@/seed/utils/logger-utility';

/** Log an invalid-signature event to error_log */
export async function logInvalidSignature(
  db: D1Database,
  network: string,
  route: string,
): Promise<void> {
  try {
    const msg = `[postback] Invalid signature from ${network}`;
    const fingerprint = await computeHmacSha256Hex('', `${msg}:Error`);
    await db
      .prepare(
        `INSERT INTO error_log (ts, level, msg, msg_class, fingerprint, ctx_json, route, status)
         VALUES (?, 'error', ?, 'SignatureError', ?, '{}', ?, 401)`,
      )
      .bind(new Date().toISOString(), msg.slice(0, 500), fingerprint.slice(0, 64), route)
      .run();
  } catch {
    // best-effort; never block the 401 response
  }
}

/**
 * Verify the HMAC signature for a network-specific postback.
 * Returns true if verification passes or is disabled.
 * Returns false if signature is present but invalid.
 * Returns true if no signature method is known for this network (pass-through).
 */
export async function verifyPostbackSignature(
  db: D1Database,
  network: string,
  linkId: string,
  rawBody: string,
  request: NextRequest,
  parsedBody: Record<string, unknown>,
): Promise<boolean> {
  const sigVerifyEnabled =
    (process.env.POSTBACK_SIGNATURE_VERIFICATION_ENABLED ?? '1') !== '0';

  if (!sigVerifyEnabled) {
    logger.warn('[postback] Signature verification DISABLED — dev mode', { network });
    return true;
  }

  const secret = await resolveNetworkSecret(db, network, linkId);
  if (!secret) {
    logger.warn('[postback] No network secret found — skipping HMAC', { network, linkId });
    return true;
  }

  switch (network) {
    case 'binance-link':
    case 'bybit': {
      const sig = request.headers.get('x-signature') ?? '';
      if (!sig) return false;
      return verifyHmacSha256Hex(secret, rawBody, sig);
    }

    case 'partnerstack': {
      const sig = request.headers.get('pstack-signature') ?? '';
      if (!sig) return false;
      return verifyHmacSha256Base64(secret, rawBody, sig);
    }

    case 'awin': {
      const url = new URL(request.url);
      const sig = url.searchParams.get('signature') ?? '';
      if (!sig) return false;
      return verifyHmacSha256Hex(secret, rawBody, sig);
    }

    case 'clickbank': {
      const cbreceipt = (parsedBody.cbreceipt as string | undefined) ?? '';
      if (!cbreceipt) return false;
      const expected = await computeHmacSha256Hex(secret, rawBody);
      return cbreceipt === expected;
    }

    case 'tiktok_shop': {
      const sig = request.headers.get('x-tiktok-signature') ?? '';
      if (!sig) return false;
      return verifyHmacSha256Hex(secret, rawBody, sig);
    }

    default:
      return true;
  }
}
