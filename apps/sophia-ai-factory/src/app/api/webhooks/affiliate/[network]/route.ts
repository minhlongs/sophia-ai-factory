/**
 * Multi-Network Affiliate Webhook Edge Route Handler
 *
 * Receives conversion events from TikTok Shop, Amazon, ClickBank, AccessTrade, Awin.
 * Verifies HMAC, writes pending commission to commission_ledger,
 * and emits Inngest conversion.created event.
 *
 * @module app/api/webhooks/affiliate/[network]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { processAffiliateWebhook } from '@/tree/affiliate/webhook-processor';
import { getD1 } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  NETWORK_CONFIGS,
  extractAffiliateSignature,
} from './affiliate-network-configs';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ network: string }> | { network: string } },
): Promise<NextResponse> {
  const resolvedParams = await Promise.resolve(context.params);
  const networkParam = resolvedParams.network.toLowerCase();
  const config = NETWORK_CONFIGS[networkParam];

  if (!config) {
    return NextResponse.json(
      { error: 'Unsupported affiliate network' },
      { status: 404 },
    );
  }

  const secret = process.env[config.secretEnv];
  if (!secret) {
    logger.warn(`[affiliate-webhook] Secret ${config.secretEnv} not configured`);
    return NextResponse.json({ ok: true, skipped: 'config' }, { status: 200 });
  }

  const signature = extractAffiliateSignature(request, config.sigHeaders);

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing signature header' },
      { status: 401 },
    );
  }

  const rawBody = await request.text();
  const db = await getD1();
  if (!db) {
    logger.warn('[affiliate-webhook] D1 database unavailable');
    return NextResponse.json(
      { ok: true, skipped: 'db_unavailable' },
      { status: 200 },
    );
  }

  const result = await processAffiliateWebhook({
    db,
    network: config.network,
    rawBody,
    signature,
    secret,
    algorithm: config.algorithm,
  });

  if (!result.success) {
    if (result.error === 'INVALID_HMAC_SIGNATURE') {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  try {
    await inngest.send({
      name: 'conversion.created',
      data: {
        conversionEventId: result.conversionId!,
        tenantId: process.env.SOPHIA_TENANT_ID ?? 'sophia-global',
      },
    });
  } catch (emitErr) {
    logger.warn('[affiliate-webhook] Inngest event emission failed (non-fatal)', {
      conversionId: result.conversionId,
      error: emitErr instanceof Error ? emitErr.message : String(emitErr),
    });
  }

  return NextResponse.json({
    ok: true,
    success: true,
    conversionId: result.conversionId,
    commissionCents: result.commissionCents,
    payableAt: result.payableAt,
    network: result.network,
  });
}
