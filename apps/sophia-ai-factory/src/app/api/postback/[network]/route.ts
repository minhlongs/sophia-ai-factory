/**
 * POST /api/postback/[network] — Generic S2S affiliate postback receiver.
 *
 * Called by affiliate networks (Binance Link, Bybit, PartnerStack, etc.)
 * when a conversion is attributed to a Sophia tracking link.
 *
 * Flow: network POSTs → validate link_id → recordConversion → 200 OK
 *
 * TODO (network-specific signature verification):
 * - Binance Link: HMAC-SHA256(apiSecret, timestamp+body)
 * - Bybit: X-Bybit-Sign header
 * - PartnerStack: X-PartnerStack-Signature header (HMAC-SHA256)
 * - Currently: link_id validation provides baseline security
 *   (each link_id is unguessable base62, tenant-isolated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordConversion } from '@/lib/tracking/edge-link';
import { logger } from '@/seed/utils/logger-utility';

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
  'generic',
]);

const PostbackSchema = z.object({
  link_id: z.string().min(8).max(8),
  external_id: z.string().optional(),
  amount_usd: z.number().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ network: string }> },
): Promise<NextResponse> {
  const { network } = await params;

  if (!KNOWN_NETWORKS.has(network)) {
    return NextResponse.json({ error: 'Unknown network' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
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

  // TODO: verify network-specific HMAC signature before recording
  // Flag: POSTBACK_SIGNATURE_VERIFICATION_ENABLED env var when ready

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
