/**
 * SaaS & Crypto Postback Service (Domain B: 100% Workspace Revenue)
 *
 * Handles timing-safe HMAC validation, tenant-scoped idempotency locks, and
 * commission ledger recording. Replay-safe: the same provider event never
 * produces two ledger rows, and a partial refund is recorded as an immutable
 * adjustment rather than being swallowed by the lifecycle dedup key.
 *
 * Layer: land/affiliates/postbacks (Business Workflow)
 * @module land/affiliates/postbacks/saas-crypto-postback-service
 */

import { verifyHmacSha256Hex, verifyHmacSha256Base64 } from '@/land/postback/hmac-verifier';
import { parseSaasCryptoPostback } from './saas-crypto-postback-parser';
import type { PostbackProcessingOutcome, SaasCryptoNetwork } from './saas-crypto-postback-types';
import { logger } from '@/seed/utils/logger-utility';
import { ADJUSTMENT_MARKER } from '@/land/affiliates/reconciliation/workspace-domain-b-reconciliation';

export interface ProcessPostbackParams {
  db?: D1Database | null;
  /** Server-resolved workspace id. Required whenever a ledger write occurs. */
  tenantId?: string;
  network: SaasCryptoNetwork;
  rawBody: string;
  signature: string;
  secret: string;
  niche?: 'crypto_global' | 'saas_global' | 'ecommerce_vn';
}

function isPartialAdjustment(payload: Record<string, unknown>): boolean {
  return (
    payload.partial_refund === true ||
    payload.is_partial_refund === true ||
    typeof payload.adjustment_id === 'string' ||
    typeof payload.adjustment_key === 'string'
  );
}

async function digestHex(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  const buffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function processSaasCryptoPostback(
  params: ProcessPostbackParams,
): Promise<PostbackProcessingOutcome> {
  const { db, network, rawBody, signature, secret, niche } = params;
  const tenantId = params.tenantId ?? '';
  const invalid = (error: string, eventId = 'unknown', commissionCents = 0): PostbackProcessingOutcome => ({
    success: false, eventId, network, commissionCents, error,
  });

  // A webhook without a server-resolved workspace must never write to a shared
  // 'default' tenant or create a global idempotency key.
  if (db && !tenantId) return invalid('TENANT_REQUIRED');

  // An empty signing secret makes HMAC verification meaningless: HMAC with an
  // empty key is computable by anyone, so accepting it would let an attacker
  // self-sign any payload. Fail closed before any crypto runs.
  if (!secret) return invalid('SECRET_NOT_CONFIGURED');

  // Strict signature validation per provider contract — no raw-secret bypass.
  let isValid = false;
  if (network === 'partnerstack' || network === 'rewardful') {
    isValid =
      (await verifyHmacSha256Base64(secret, rawBody, signature)) ||
      (await verifyHmacSha256Hex(secret, rawBody, signature));
  } else {
    // binance, bybit
    isValid = await verifyHmacSha256Hex(secret, rawBody, signature);
  }
  if (!isValid) return invalid('INVALID_SIGNATURE');

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return invalid('MALFORMED_JSON', 'malformed');
  }

  const normalized = parseSaasCryptoPostback(network, payload);
  // Provider garbage (e.g. a non-numeric amount) normalizes to NaN/Infinity,
  // which would sail past the `<= 0` check below (all NaN comparisons are
  // false) and reach the ledger bind. Reject loudly instead of relying on the
  // database driver to fail the write.
  if (!Number.isFinite(normalized.commissionCents)) {
    return invalid('INVALID_COMMISSION', normalized.eventId);
  }
  const isReversal = normalized.reconciliationStatus === 'reversed';
  if (!isReversal && normalized.commissionCents <= 0) {
    return invalid('ZERO_COMMISSION', normalized.eventId);
  }

  const effectiveCommissionCents = Math.abs(normalized.commissionCents);
  const resolvedNiche =
    niche ?? (network === 'binance' || network === 'bybit' ? 'crypto_global' : 'saas_global');
  // `commission_events.event_id` is a GLOBAL primary key in migration 0206.
  // Namespacing the value keeps tenant A's replay from suppressing tenant B.
  const scopedEventId = tenantId ? `${tenantId}:${normalized.eventId}` : normalized.eventId;

  if (!db) {
    return {
      success: true,
      eventId: normalized.eventId,
      network,
      commissionCents: effectiveCommissionCents,
      platformFeeCents: 0,
      isIdempotentDuplicate: false,
    };
  }

  try {
    // 1. Tenant-scoped provider event lock. A duplicate callback is a no-op
    //    BEFORE any ledger write, including partial-adjustment computation.
    const prior = await db
      .prepare('SELECT event_id FROM opc_postback_events WHERE tenant_id = ? AND event_id = ?')
      .bind(tenantId, normalized.eventId)
      .first<{ event_id: string }>();
    if (prior) {
      return {
        success: true,
        eventId: normalized.eventId,
        network,
        commissionCents: effectiveCommissionCents,
        platformFeeCents: 0,
        isIdempotentDuplicate: true,
      };
    }

    // 2. Partial refunds/adjustments are distinct immutable rows. The suffix is
    //    a hash of the exact provider payload, so replays stay deterministic.
    const partial = isReversal && isPartialAdjustment(payload);
    const digest = partial ? (await digestHex(rawBody)).slice(0, 16) : '';
    const ledgerTxId = partial
      ? `${normalized.externalTxnId}${ADJUSTMENT_MARKER}${digest}`
      : normalized.externalTxnId;

    const ledgerRes = await db
      .prepare(
        `INSERT INTO workspace_external_commissions
         (id, tenant_id, campaign_id, network, niche, external_tx_id, sub_id, event_type,
          status, gross_amount_cents, commission_cents, platform_fee_cents, currency,
          is_recurring, raw_payload, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, network, external_tx_id, status) DO NOTHING`,
      )
      .bind(
        crypto.randomUUID(),
        tenantId,
        normalized.campaignId,
        normalized.network,
        resolvedNiche,
        ledgerTxId,
        normalized.subId,
        normalized.eventType,
        normalized.reconciliationStatus,
        normalized.grossAmountCents,
        effectiveCommissionCents,
        normalized.currency,
        normalized.isRecurring ? 1 : 0,
        rawBody,
        normalized.timestampMs,
      )
      .run();

    const isDuplicate = Boolean(ledgerRes.meta && ledgerRes.meta.changes === 0);

    // 3. Mark the event recorded only after the ledger write succeeded.
    await db
      .prepare(
        `INSERT INTO commission_events (event_id, event_type, payload, processed)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(event_id) DO UPDATE SET processed = 1`,
      )
      .bind(scopedEventId, normalized.eventType, rawBody)
      .run();

    await db
      .prepare(
        `INSERT INTO opc_postback_events
          (tenant_id, event_id, network, external_tx_id, provider_time_ms, ingest_seq, raw_hash)
         VALUES (?, ?, ?, ?, ?, 0, ?)
         ON CONFLICT(tenant_id, event_id) DO NOTHING`,
      )
      .bind(tenantId, normalized.eventId, network, ledgerTxId, normalized.timestampMs, digest || null)
      .run();

    return {
      success: true,
      eventId: normalized.eventId,
      network,
      commissionCents: effectiveCommissionCents,
      platformFeeCents: 0,
      isIdempotentDuplicate: isDuplicate,
    };
  } catch (err) {
    logger.error('[saas-crypto-postback] D1 write failed', {
      eventId: normalized.eventId,
      error: err instanceof Error ? err.message : String(err),
    });
    return invalid('DB_WRITE_FAILED', normalized.eventId);
  }
}
