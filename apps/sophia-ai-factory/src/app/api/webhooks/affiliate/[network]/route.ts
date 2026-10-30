/**
 * Multi-Network Affiliate Webhook Edge Route Handler (legacy compat delegate).
 *
 * Receives conversion events from TikTok Shop, Amazon, AccessTrade, Awin.
 * Delegates to the shared tenant-scoped ecommerce core, preserving this
 * endpoint's signature headers and HMAC algorithm per network.
 *
 * ClickBank is served by its dedicated flow at /api/webhooks/clickbank.
 *
 * @module app/api/webhooks/affiliate/[network]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  processLegacyEcommercePostback,
  type LegacyEcommerceContract,
} from '@/land/postback/legacy-ecommerce-handler';
import { LEGACY_MIGRATION_GUIDANCE } from '@/land/postback/legacy-tenant-resolver';
import { NETWORK_CONFIGS } from './affiliate-network-configs';

type EcommerceSlug = 'accesstrade' | 'amazon' | 'awin' | 'tiktok_shop';

const SLUG_MAP: Record<string, EcommerceSlug | 'clickbank'> = {
  tiktok_shop: 'tiktok_shop',
  'tiktok-shop': 'tiktok_shop',
  amazon_associates: 'amazon',
  amazon: 'amazon',
  clickbank: 'clickbank',
  accesstrade: 'accesstrade',
  awin: 'awin',
};

const CONTRACT_FIELDS: Record<
  EcommerceSlug,
  Pick<
    LegacyEcommerceContract,
    'txnIdFields' | 'subIdFields' | 'clickIdField' | 'grossField' | 'commissionField' | 'approvedStatus' | 'missingTxnSkipCode'
  >
> = {
  accesstrade: {
    txnIdFields: ['conversion_id'],
    subIdFields: ['sub_id'],
    clickIdField: 'click_id',
    grossField: 'order_value',
    commissionField: 'commission',
    approvedStatus: 'approved',
    missingTxnSkipCode: 'no_conversion_id',
  },
  amazon: {
    txnIdFields: ['order_id'],
    subIdFields: ['tag'],
    clickIdField: null,
    grossField: 'revenue',
    commissionField: 'commission',
    approvedStatus: 'shipped',
    missingTxnSkipCode: 'no_order_id',
  },
  awin: {
    txnIdFields: ['id'],
    subIdFields: ['click_ref'],
    clickIdField: null,
    grossField: 'sale_amount',
    commissionField: 'commission_amount',
    approvedStatus: 'approved',
    missingTxnSkipCode: 'no_transaction_id',
  },
  tiktok_shop: {
    txnIdFields: ['order_id'],
    subIdFields: ['sub_id'],
    clickIdField: null,
    grossField: 'settlement_amount',
    commissionField: 'commission_amount',
    approvedStatus: null,
    missingTxnSkipCode: 'no_order_id',
  },
};

const DB_NETWORK: Record<EcommerceSlug, string> = {
  accesstrade: 'accesstrade',
  amazon: 'amazon',
  awin: 'awin',
  tiktok_shop: 'tiktok_shop',
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ network: string }> | { network: string } },
): Promise<NextResponse> {
  const resolvedParams = await Promise.resolve(context.params);
  const networkParam = resolvedParams.network.toLowerCase();
  const config = NETWORK_CONFIGS[networkParam];
  const slug = SLUG_MAP[networkParam];

  if (!config || !slug) {
    return NextResponse.json(
      { error: 'Unsupported affiliate network' },
      { status: 404 },
    );
  }

  if (slug === 'clickbank') {
    // ClickBank Instant Notifications are served by the dedicated flow with
    // attribution and reversal handling; this generic path never supported it.
    return NextResponse.json(
      {
        ok: false,
        error: 'network_moved',
        canonical: '/api/webhooks/clickbank',
        guidance: LEGACY_MIGRATION_GUIDANCE,
      },
      { status: 501 },
    );
  }

  const outcome = await processLegacyEcommercePostback(request, {
    slug,
    dbNetwork: DB_NETWORK[slug],
    sigHeaders: config.sigHeaders,
    algorithm: config.algorithm,
    logTag: 'affiliate-webhook',
    ...CONTRACT_FIELDS[slug],
  });

  if (outcome.status !== 200 || outcome.body.skipped) {
    return NextResponse.json(outcome.body, { status: outcome.status });
  }

  // Fresh receipt: preserve this endpoint's informative envelope.
  const commissionCents = Math.round(Number(outcome.body.commissionUsd ?? 0) * 100);
  const envelope = {
    ok: true,
    success: true,
    conversionId: outcome.body.transactionId,
    commissionCents,
    payableAt: Date.now() + 14 * 86400 * 1000,
    network: slug,
  };

  const tenantId =
    typeof outcome.body.tenantId === 'string' ? outcome.body.tenantId : null;
  const transactionId =
    typeof outcome.body.transactionId === 'string' ? outcome.body.transactionId : null;
  if (tenantId && transactionId) {
    try {
      await inngest.send({
        name: 'conversion.created',
        data: {
          conversionEventId: transactionId,
          tenantId,
        },
      });
    } catch (emitErr) {
      logger.warn('[affiliate-webhook] Inngest event emission failed (non-fatal)', {
        conversionId: outcome.body.transactionId,
        error: emitErr instanceof Error ? emitErr.message : String(emitErr),
      });
    }
  }

  return NextResponse.json(envelope);
}
