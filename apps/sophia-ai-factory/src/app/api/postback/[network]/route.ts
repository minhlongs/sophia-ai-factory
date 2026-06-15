/**
 * POST /api/postback/[network] — Generic S2S affiliate postback receiver.
 *
 * Called by affiliate networks (Binance Link, Bybit, PartnerStack, etc.)
 * when a conversion is attributed to a Sophia tracking link.
 *
 * Flow: network POSTs → HMAC verify → validate link_id → recordConversion → 200 OK
 *
 * Signature verification is enabled by default.
 * Set POSTBACK_SIGNATURE_VERIFICATION_ENABLED=0 to bypass (dev/staging only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordConversion } from '@/land/tracking/edge-link';
import { logger } from '@/seed/utils/logger-utility';
import { getD1 } from '@/seed/db/client';
import { resolveNetworkSecret } from '@/land/postback/network-secret-resolver';
import {
  verifyHmacSha256Hex,
  verifyHmacSha256Base64,
  computeHmacSha256Hex,
} from '@/land/postback/hmac-verifier';

export const dynamic = 'force-dynamic';

// Known postback-capable networks (allowlist)
const KNOWN_NETWORKS = new Set([
  'binance-link',
  'bybit',
  'bitget',
  'okx',
  'partnerstack',
  'impact',
  'cj',
  'awin',
  'clickbank',
  'tiktok_shop',
  'generic',
]);

const PostbackSchema = z.object({
  link_id: z.string().min(8).max(8),
  external_id: z.string().optional(),
  amount_usd: z.number().optional(),
});

/** Log an invalid-signature event to error_log */
async function logInvalidSignature(
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
async function verifyPostbackSignature(
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
    // No credentials stored for this tenant+network — skip HMAC, allow pass-through
    // (link_id validation provides baseline security)
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
      // ClickBank uses cbreceipt field (legacy HMAC-MD5 fallback not supported in Web Crypto)
      // Try HMAC-SHA256 first; if clerk_key is present this should match
      const cbreceipt = (parsedBody.cbreceipt as string | undefined) ?? '';
      if (!cbreceipt) return false;
      const expected = await computeHmacSha256Hex(secret, rawBody);
      return cbreceipt === expected;
    }

    case 'tiktok_shop': {
      // TikTok Shop: HMAC-SHA256 of sorted query + body using app_secret
      // Signature in X-Tiktok-Signature header
      const sig = request.headers.get('x-tiktok-signature') ?? '';
      if (!sig) return false;
      return verifyHmacSha256Hex(secret, rawBody, sig);
    }

    default:
      // No HMAC spec known for this network — allow pass-through
      return true;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ network: string }> },
): Promise<NextResponse> {
  const { network } = await params;

  if (!KNOWN_NETWORKS.has(network)) {
    return NextResponse.json({ error: 'Unknown network' }, { status: 404 });
  }

  // Read raw body BEFORE parsing JSON — needed for HMAC verification
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PostbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Missing required field: link_id' },
      { status: 422 },
    );
  }

  const route = `/api/postback/${network}`;

  // HMAC signature verification (P0 security gate)
  let db: D1Database;
  const _db = getD1();
  if (!_db) {
    logger.error('[postback] D1 unavailable');
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
  db = _db;
  try {
    const valid = await verifyPostbackSignature(
      db,
      network,
      parsed.data.link_id,
      rawBody,
      request,
      body as Record<string, unknown>,
    );

    if (!valid) {
      logger.error('[postback] Invalid signature — rejected', { network, linkId: parsed.data.link_id });
      await logInvalidSignature(db, network, route);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } catch (sigErr) {
    const msg = sigErr instanceof Error ? sigErr.message : String(sigErr);
    logger.error('[postback] Signature verification error', { network, error: msg });
    // On internal error, fail closed — reject the postback
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 500 });
  }

  try {
    await recordConversion(parsed.data.link_id, network, {
      externalConversionId: parsed.data.external_id,
      amountUsd: parsed.data.amount_usd,
      ...(body as Record<string, unknown>),
    });

    logger.info('[postback] Conversion recorded', {
      network,
      linkId: parsed.data.link_id,
      amountUsd: parsed.data.amount_usd,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Return 200 to prevent retries for invalid link IDs
    logger.warn('[postback] Conversion failed to record', { network, error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
