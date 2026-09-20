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
import type { AffiliateNetwork } from '@/tree/affiliate/attribution-parser';

interface NetworkConfig {
  network: AffiliateNetwork;
  secretEnv: string;
  sigHeaders: string[];
  algorithm: 'SHA-256' | 'SHA-1' | 'SHA-512';
}

const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  tiktok_shop: {
    network: 'tiktok_shop',
    secretEnv: 'TIKTOK_SHOP_WEBHOOK_SECRET',
    sigHeaders: ['x-tts-signature', 'x-signature'],
    algorithm: 'SHA-256',
  },
  'tiktok-shop': {
    network: 'tiktok_shop',
    secretEnv: 'TIKTOK_SHOP_WEBHOOK_SECRET',
    sigHeaders: ['x-tts-signature', 'x-signature'],
    algorithm: 'SHA-256',
  },
  amazon_associates: {
    network: 'amazon_associates',
    secretEnv: 'AMAZON_WEBHOOK_SECRET',
    sigHeaders: ['x-amazon-signature', 'x-amz-signature', 'x-signature'],
    algorithm: 'SHA-256',
  },
  amazon: {
    network: 'amazon_associates',
    secretEnv: 'AMAZON_WEBHOOK_SECRET',
    sigHeaders: ['x-amazon-signature', 'x-amz-signature', 'x-signature'],
    algorithm: 'SHA-256',
  },
  clickbank: {
    network: 'clickbank',
    secretEnv: 'CLICKBANK_INS_SECRET',
    sigHeaders: ['x-clickbank-signature', 'authorization', 'x-signature'],
    algorithm: 'SHA-1',
  },
  accesstrade: {
    network: 'accesstrade',
    secretEnv: 'ACCESSTRADE_WEBHOOK_SECRET',
    sigHeaders: ['x-accesstrade-signature', 'x-signature'],
    algorithm: 'SHA-256',
  },
  awin: {
    network: 'awin',
    secretEnv: 'AWIN_WEBHOOK_SECRET',
    sigHeaders: ['x-awin-signature', 'x-signature'],
    algorithm: 'SHA-256',
  },
};

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

  // Extract signature from candidate headers
  let signature = '';
  for (const h of config.sigHeaders) {
    const val = request.headers.get(h);
    if (val) {
      signature = val;
      break;
    }
  }

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

  // Emit Inngest conversion.created event
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
