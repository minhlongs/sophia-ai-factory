/**
 * SaaS & Crypto Affiliate Webhook Edge Route Handler
 *
 * Ingests real-time conversion postbacks from PartnerStack, Rewardful, Binance Link, and Bybit.
 * Verifies HMAC/secret token, performs idempotent D1 storage, and triggers conversion workflows.
 *
 * Layer: app/api/webhooks/saas-crypto/[network] (Interface Adapter / Edge Route)
 * @module app/api/webhooks/saas-crypto/[network]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { processSaasCryptoPostback } from '@/land/affiliates/postbacks/saas-crypto-postback-service';
import type { SaasCryptoNetwork } from '@/land/affiliates/postbacks/saas-crypto-postback-types';
import { getD1 } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

interface NetworkSecretConfig {
  network: SaasCryptoNetwork;
  secretEnv: string;
  sigHeaders: string[];
}

const SAAS_CRYPTO_NETWORKS: Record<string, NetworkSecretConfig> = {
  partnerstack: {
    network: 'partnerstack',
    secretEnv: 'PARTNERSTACK_WEBHOOK_SECRET',
    sigHeaders: ['x-partnerstack-signature', 'x-signature', 'x-webhook-signature', 'authorization'],
  },
  rewardful: {
    network: 'rewardful',
    secretEnv: 'REWARDFUL_WEBHOOK_SECRET',
    sigHeaders: ['x-rewardful-signature', 'x-signature', 'x-webhook-signature', 'authorization'],
  },
  binance: {
    network: 'binance',
    secretEnv: 'BINANCE_AFFILIATE_WEBHOOK_SECRET',
    sigHeaders: ['x-binance-signature', 'x-signature', 'authorization'],
  },
  bybit: {
    network: 'bybit',
    secretEnv: 'BYBIT_AFFILIATE_WEBHOOK_SECRET',
    sigHeaders: ['x-bybit-signature', 'x-signature', 'authorization'],
  },
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ network: string }> | { network: string } },
): Promise<NextResponse> {
  const resolvedParams = await Promise.resolve(context.params);
  const rawNetwork = resolvedParams.network.toLowerCase();
  const config = SAAS_CRYPTO_NETWORKS[rawNetwork];

  if (!config) {
    return NextResponse.json({ error: 'Unsupported SaaS/Crypto affiliate network' }, { status: 404 });
  }

  const secret = process.env[config.secretEnv];
  if (!secret) {
    logger.warn(`[saas-crypto-webhook] Secret ${config.secretEnv} not configured`);
    return NextResponse.json({ ok: true, skipped: 'secret_not_configured' }, { status: 200 });
  }

  let signature = '';
  for (const headerName of config.sigHeaders) {
    const val = request.headers.get(headerName);
    if (val) {
      signature = val.replace(/^Bearer\s+/i, '').trim();
      break;
    }
  }

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature or auth header' }, { status: 401 });
  }

  const rawBody = await request.text();
  const db = await getD1();

  const outcome = await processSaasCryptoPostback({
    db,
    network: config.network,
    rawBody,
    signature,
    secret,
  });

  if (!outcome.success) {
    if (outcome.error === 'INVALID_SIGNATURE') {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: outcome.error }, { status: 422 });
  }

  if (!outcome.isIdempotentDuplicate) {
    try {
      await inngest.send({
        name: 'conversion.created',
        data: {
          conversionEventId: outcome.eventId,
          tenantId: process.env.SOPHIA_TENANT_ID ?? 'sophia-global',
        },
      });
    } catch (emitErr: unknown) {
      logger.warn('[saas-crypto-webhook] Inngest conversion.created emit failed (non-fatal)', {
        eventId: outcome.eventId,
        error: emitErr instanceof Error ? emitErr.message : String(emitErr),
      });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      success: true,
      eventId: outcome.eventId,
      network: outcome.network,
      commissionCents: outcome.commissionCents,
      isIdempotentDuplicate: Boolean(outcome.isIdempotentDuplicate),
    },
    { status: 200 },
  );
}
