/**
 * SaaS/Crypto Affiliate Postback Endpoint — LEGACY tenant-scoped delegate.
 *
 * Historical contract preserved: networks (partnerstack/rewardful/binance/
 * bybit), signature headers (x-partnerstack-signature, x-rewardful-signature,
 * x-signature, authorization Bearer), response envelope, and the Domain B
 * ledger service (normalizers, payouts, reconciliations) all unchanged.
 *
 * What changed: tenant + secret are server-resolved. The workspace comes from
 * the request's attributable sub-id / tenant hint, the signing secret comes
 * from that workspace's stored credential (BYOK), and the resolved tenantId
 * is passed through to the ledger service — no global env secret, no
 * 'sophia-global' tenant fallback in the Inngest fan-out.
 *
 * Canonical endpoint: /api/postback/{network}. No sunset is set on this URL.
 *
 * Layer: app/api/webhooks/saas-crypto
 * @module app/api/webhooks/saas-crypto/[network]/route
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { processSaasCryptoPostback } from '@/land/affiliates/postbacks/saas-crypto-postback-service';
import type { SaasCryptoNetwork } from '@/land/affiliates/postbacks/saas-crypto-postback-types';
import { getD1 } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  resolveLegacyTenantSecret,
  LEGACY_MIGRATION_GUIDANCE,
} from '@/land/postback/legacy-tenant-resolver';
import { enqueuePostbackDlq } from '@/land/postback/postback-dead-letter';

interface RouteParams {
  network: string;
}

/**
 * Historical per-network signature-header contract (unchanged).
 * Header names are matched case-insensitively by the Headers API.
 */
const SUPPORTED_NETWORKS: Record<string, { network: SaasCryptoNetwork; sigHeaders: string[] }> = {
  partnerstack: { network: 'partnerstack', sigHeaders: ['x-partnerstack-signature'] },
  rewardful: { network: 'rewardful', sigHeaders: ['x-rewardful-signature', 'x-signature'] },
  binance: { network: 'binance', sigHeaders: ['x-signature', 'authorization'] },
  bybit: { network: 'bybit', sigHeaders: ['x-signature', 'authorization'] },
};

/**
 * Domain B outcome -> HTTP status. Transient storage/config failures are 503
 * (provider retries); everything else the service rejected is permanent for
 * this exact payload and maps to 4xx so the provider does not retry-storm.
 */
function mapOutcomeStatus(error: string | undefined): number {
  switch (error) {
    case 'INVALID_SIGNATURE':
      return 401;
    case 'MALFORMED_JSON':
      return 400;
    case 'SECRET_NOT_CONFIGURED':
    case 'DB_WRITE_FAILED':
      return 503;
    default:
      return 422;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<RouteParams> | RouteParams },
): Promise<NextResponse> {
  const { network: networkParam } = await context.params;
  const config = SUPPORTED_NETWORKS[networkParam];
  if (!config) {
    return NextResponse.json({ ok: false, error: 'unsupported_network' }, { status: 404 });
  }

  const rawBody = await request.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'MALFORMED_JSON' }, { status: 400 });
  }

  const signatureHeader =
    config.sigHeaders.map((h) => request.headers.get(h)).find((v) => v) ?? '';
  const signature = signatureHeader.replace(/^Bearer\s+/i, '').trim();
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature or auth header' }, { status: 401 });
  }

  const db = await getD1();
  if (!db) {
    logger.error('[saas-crypto-webhook] D1 binding unavailable');
    return NextResponse.json({ ok: false, error: 'db_unavailable' }, { status: 503 });
  }

  const subCandidates = [
    payload['sub_id'],
    payload['link_id'],
    payload['click_ref'],
    payload['partner_key'],
    payload['referralId'],
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);
  const explicitTenantId =
    typeof payload['tenant_id'] === 'string' ? (payload['tenant_id'] as string) : undefined;

  const resolution = await resolveLegacyTenantSecret({
    db,
    dbNetwork: config.network,
    subIdCandidates: subCandidates,
    explicitTenantId: explicitTenantId ?? null,
  });
  if (!resolution.ok) {
    await enqueuePostbackDlq({
      network: config.network,
      endpoint: request.url,
      sourceIp: request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for'),
      headersJson: JSON.stringify(Object.fromEntries(request.headers.entries())),
      rawBody,
      failureReason: resolution.error,
      tenantHint: 'tenantId' in resolution ? resolution.tenantId : (explicitTenantId ?? null),
    });

    const status = resolution.error === 'secret_not_configured' ? 503 : 422;
    return NextResponse.json(
      {
        ok: false,
        error: resolution.error,
        ...('tenantId' in resolution ? { tenantId: resolution.tenantId } : {}),
        guidance: LEGACY_MIGRATION_GUIDANCE,
      },
      { status },
    );
  }

  const outcome = await processSaasCryptoPostback({
    db,
    tenantId: resolution.tenantId,
    network: config.network,
    rawBody,
    signature,
    secret: resolution.secret,
  });

  if (!outcome.success) {
    const status = mapOutcomeStatus(outcome.error);
    return NextResponse.json({ ok: false, error: outcome.error }, { status });
  }

  if (!outcome.isIdempotentDuplicate) {
    try {
      await inngest.send({
        name: 'conversion.created',
        data: {
          conversionEventId: outcome.eventId,
          tenantId: resolution.tenantId,
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
