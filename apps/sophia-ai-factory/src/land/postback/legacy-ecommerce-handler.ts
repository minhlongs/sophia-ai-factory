/**
 * Shared delegation core for legacy ecommerce affiliate webhooks
 * (AccessTrade, Amazon Associates, Awin, TikTok Shop).
 *
 * Replaces four copy-pasted singleton implementations and the tenant-less
 * `webhooks/affiliate/[network]` processor path with one tenant-scoped flow
 * that preserves each endpoint's provider contract exactly:
 *
 *   - same signature headers and HMAC algorithm per endpoint (no format change)
 *   - same payload field mapping per network (no silent re-mapping)
 *   - same durable receipt table (conversion_events)
 *
 * What changes (mandated tenant-safety fixes):
 *   - the signing secret comes from the resolved workspace's stored credential,
 *     never from a global env secret;
 *   - unknown tenant/link fails closed (422 + migration guidance) instead of
 *     recording under a global tenant or link 'unknown';
 *   - storage/config failures return 503 (retry) instead of a false 200 ack.
 *   - permanent garbage (unparseable body, missing transaction id) keeps the
 *     legacy 200 + skipped code so providers do not retry storms.
 *
 * Layer: land/postback (Business Workflow)
 * @module land/postback/legacy-ecommerce-handler
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  verifyAffiliateHmac,
  type HmacAlgorithm,
} from '@/tree/affiliate/hmac-verifier';
import {
  resolveLegacyTenantSecret,
  LEGACY_MIGRATION_GUIDANCE,
} from './legacy-tenant-resolver';
import { enqueuePostbackDlq } from './postback-dead-letter';
import { recordLegacyEcommerceConversion } from './legacy-ecommerce-recorder';

/** Minimal request surface (keeps this module free of Next.js types). */
export interface LegacyPostbackRequest {
  text(): Promise<string>;
  url: string;
  headers: { get(name: string): string | null };
}

export interface LegacyEcommerceContract {
  /** Canonical slug, also the receipt namespace. */
  slug: 'accesstrade' | 'amazon' | 'awin' | 'tiktok_shop';
  /** Credential-store network value. */
  dbNetwork: string;
  /** Signature header names in legacy lookup order — unchanged per endpoint. */
  sigHeaders: string[];
  algorithm: HmacAlgorithm;
  logTag: string;
  /** Transaction-id fields, first non-empty wins (String-coerced). */
  txnIdFields: string[];
  /** Sub-id/link-candidate fields for tenant attribution. */
  subIdFields: string[];
  /** Click-id passthrough field (AccessTrade) or null. */
  clickIdField: string | null;
  grossField: string;
  commissionField: string;
  /**
   * Payload status value meaning 'approved'; anything else records 'pending'.
   * null pins every receipt to 'pending' (TikTok Shop legacy behavior).
   */
  approvedStatus: string | null;
  /** Legacy skipped code when the transaction id is absent. */
  missingTxnSkipCode: string;
}

export type LegacyEcommerceOutcome =
  | { status: 200; body: Record<string, unknown> }
  | { status: 400 | 401 | 422 | 503; body: Record<string, unknown> };

function firstNonEmpty(payload: Record<string, unknown>, fields: string[]): string {
  for (const f of fields) {
    const v = payload[f];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function extractExplicitTenantId(
  request: LegacyPostbackRequest,
  body: Record<string, unknown>,
): string | null {
  const url = new URL(request.url);
  const raw = body.tenant_id ?? body.tenantId ?? url.searchParams.get('tenant_id');
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

function extractSignature(request: LegacyPostbackRequest, sigHeaders: string[]): string {
  for (const h of sigHeaders) {
    const val = request.headers.get(h);
    if (val) return val;
  }
  return '';
}

function asNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Execute the tenant-scoped legacy ecommerce flow. Pure result — the route
 * adapter renders the HTTP response.
 */
export async function processLegacyEcommercePostback(
  request: LegacyPostbackRequest,
  contract: LegacyEcommerceContract,
): Promise<LegacyEcommerceOutcome> {
  const tag = contract.logTag;

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return { status: 400, body: { error: 'Failed to read request body' } };
  }

  const signature = extractSignature(request, contract.sigHeaders);
  if (!signature) {
    return { status: 401, body: { error: 'Missing signature header' } };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    // Permanent garbage: ack so the provider does not retry-storm a body that
    // can never parse. Nothing is recorded.
    return { status: 200, body: { ok: true, skipped: 'parse_error' } };
  }

  const providerTxnId = firstNonEmpty(payload, contract.txnIdFields);
  if (!providerTxnId) {
    return { status: 200, body: { ok: true, skipped: contract.missingTxnSkipCode } };
  }

  const db = await getD1();
  if (!db) {
    logger.warn(`[${tag}] D1 unavailable`);
    return { status: 503, body: { ok: false, error: 'db_unavailable' } };
  }

  const subIdCandidates = contract.subIdFields.map((f) => {
    const v = payload[f];
    return typeof v === 'string' ? v : null;
  });
  const resolution = await resolveLegacyTenantSecret({
    db,
    dbNetwork: contract.dbNetwork,
    subIdCandidates,
    explicitTenantId: extractExplicitTenantId(request, payload),
  });
  if (!resolution.ok) {
    await enqueuePostbackDlq({
      network: contract.slug,
      endpoint: request.url,
      sourceIp: request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for'),
      headersJson: JSON.stringify(Object.fromEntries(request.headers.entries())),
      rawBody,
      failureReason: resolution.error,
      tenantHint: 'tenantId' in resolution ? resolution.tenantId : extractExplicitTenantId(request, payload),
    });

    if (resolution.error === 'tenant_unresolvable') {
      return {
        status: 422,
        body: {
          ok: false,
          error: 'tenant_unresolvable',
          guidance: LEGACY_MIGRATION_GUIDANCE,
        },
      };
    }
    return {
      status: 503,
      body: {
        ok: false,
        error: 'secret_not_configured',
        tenantId: resolution.tenantId,
        guidance: LEGACY_MIGRATION_GUIDANCE,
      },
    };
  }

  const valid = await verifyAffiliateHmac(rawBody, signature, resolution.secret, contract.algorithm);
  if (!valid) {
    logger.warn(`[${tag}] invalid signature`);
    return { status: 401, body: { error: 'Invalid signature' } };
  }

  if (!resolution.linkId) {
    // Verified tenant but no attributable link: recording would create an
    // orphan row no dashboard can attribute. Capture to DLQ and fail closed.
    await enqueuePostbackDlq({
      network: contract.slug,
      endpoint: request.url,
      sourceIp: request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for'),
      headersJson: JSON.stringify(Object.fromEntries(request.headers.entries())),
      rawBody,
      failureReason: 'link_unattributed',
      tenantHint: resolution.tenantId,
    });
    return {
      status: 422,
      body: {
        ok: false,
        error: 'link_unattributed',
        tenantId: resolution.tenantId,
        guidance: LEGACY_MIGRATION_GUIDANCE,
      },
    };
  }

  const grossAmount = asNumber(payload[contract.grossField]);
  const commission = asNumber(payload[contract.commissionField]);
  const status =
    contract.approvedStatus !== null && payload.status === contract.approvedStatus
      ? 'approved'
      : 'pending';
  const clickId =
    contract.clickIdField !== null && typeof payload[contract.clickIdField] === 'string'
      ? (payload[contract.clickIdField] as string)
      : null;
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    const recorded = await recordLegacyEcommerceConversion(db, {
      tenantId: resolution.tenantId,
      linkId: resolution.linkId,
      clickId,
      network: contract.slug,
      providerTxnId,
      grossAmountUsd: grossAmount,
      commissionUsd: commission,
      status,
      attributedAtSec: nowSec,
    });
    if (recorded.duplicate) {
      return { status: 200, body: { ok: true, skipped: 'duplicate' } };
    }
  } catch (err) {
    logger.warn(`[${tag}] receipt write failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return { status: 503, body: { ok: false, error: 'db_write_failed' } };
  }

  if (contract.slug === 'tiktok_shop') {
    // Preserve the legacy TikTok revenue-ingestion side effect (non-fatal).
    try {
      const { writeConversionRevenueEvent } = await import(
        '@/land/analytics/tiktok-revenue-ingestion'
      );
      await writeConversionRevenueEvent({
        conversionEventId: providerTxnId,
        tenantId: resolution.tenantId,
        affiliateId: resolution.tenantId,
        grossAmountUsd: grossAmount,
        commissionUsd: commission,
        attributedAt: nowSec,
        offerId: resolution.linkId,
      });
    } catch (revErr) {
      logger.warn(`[${tag}] Conversion revenue write error (non-fatal)`, {
        error: revErr instanceof Error ? revErr.message : String(revErr),
      });
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      network: contract.slug,
      transactionId: providerTxnId,
      tenantId: resolution.tenantId,
      commissionUsd: commission,
      status,
    },
  };
}
