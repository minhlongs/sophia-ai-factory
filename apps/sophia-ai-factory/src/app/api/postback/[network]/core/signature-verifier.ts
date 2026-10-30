import type { NextRequest } from 'next/server';
import { verifyHmacSha256Hex, verifyHmacSha256Base64 } from '@/land/postback/hmac-verifier';
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
    // Plain SHA-256 (no HMAC key): WebCrypto rejects zero-length HMAC keys,
    // which previously threw here and silently skipped the audit row.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${msg}:Error`));
    const fingerprint = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
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
 * Returns false if signature is present but invalid or network is unhandled (fail-closed).
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
    logger.warn('[postback] No network secret found — rejecting', { network, linkId });
    return false;
  }

  switch (network) {
    case 'binance-link':
    case 'binance':
    case 'bybit':
    case 'bitget':
    case 'okx': {
      const sig = request.headers.get('x-signature') ?? '';
      if (!sig) return false;
      return verifyHmacSha256Hex(secret, rawBody, sig);
    }

    case 'partnerstack': {
      const sig = request.headers.get('pstack-signature') ?? '';
      if (!sig) return false;
      return (
        (await verifyHmacSha256Base64(secret, rawBody, sig)) ||
        (await verifyHmacSha256Hex(secret, rawBody, sig))
      );
    }

    case 'rewardful': {
      const sig =
        request.headers.get('x-rewardful-signature') ??
        request.headers.get('x-signature') ??
        '';
      if (!sig) return false;
      return (
        (await verifyHmacSha256Base64(secret, rawBody, sig)) ||
        (await verifyHmacSha256Hex(secret, rawBody, sig))
      );
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
      return verifyHmacSha256Hex(secret, rawBody, cbreceipt);
    }

    case 'tiktok_shop': {
      const sig = request.headers.get('x-tiktok-signature') ?? '';
      if (!sig) return false;
      return verifyHmacSha256Hex(secret, rawBody, sig);
    }

    default:
      logger.warn('[postback] Unknown network rejected by fail-closed signature policy', { network });
      return false;
  }
}
