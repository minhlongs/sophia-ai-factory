/**
 * SaaS & Crypto Postback Service (Domain B: 100% Workspace Revenue)
 *
 * Handles timing-safe HMAC validation, idempotency locks, and commission ledger recording.
 * Layer: land/affiliates/postbacks (Business Workflow)
 * @module land/affiliates/postbacks/saas-crypto-postback-service
 */

import { verifyHmacSha256Hex, verifyHmacSha256Base64 } from '@/land/postback/hmac-verifier';
import { parseSaasCryptoPostback } from './saas-crypto-postback-parser';
import type { PostbackProcessingOutcome, SaasCryptoNetwork } from './saas-crypto-postback-types';
import { logger } from '@/seed/utils/logger-utility';

export interface ProcessPostbackParams {
  db?: D1Database | null;
  tenantId?: string;
  network: SaasCryptoNetwork;
  rawBody: string;
  signature: string;
  secret: string;
  niche?: 'crypto_global' | 'saas_global' | 'ecommerce_vn';
}

export async function processSaasCryptoPostback(
  params: ProcessPostbackParams,
): Promise<PostbackProcessingOutcome> {
  const { db, tenantId = 'default', network, rawBody, signature, secret, niche } = params;

  // Strict signature validation per provider contract — no raw-secret bypass
  let isValid = false;
  if (network === 'partnerstack') {
    isValid =
      (await verifyHmacSha256Base64(secret, rawBody, signature)) ||
      (await verifyHmacSha256Hex(secret, rawBody, signature));
  } else if (network === 'rewardful') {
    isValid =
      (await verifyHmacSha256Base64(secret, rawBody, signature)) ||
      (await verifyHmacSha256Hex(secret, rawBody, signature));
  } else {
    // binance, bybit
    isValid = await verifyHmacSha256Hex(secret, rawBody, signature);
  }

  if (!isValid) {
    return { success: false, eventId: 'unknown', network, commissionCents: 0, error: 'INVALID_SIGNATURE' };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { success: false, eventId: 'malformed', network, commissionCents: 0, error: 'MALFORMED_JSON' };
  }

  const normalized = parseSaasCryptoPostback(network, payload);
  const isReversal = normalized.reconciliationStatus === 'reversed';

  if (!isReversal && normalized.commissionCents <= 0) {
    return { success: false, eventId: normalized.eventId, network, commissionCents: 0, error: 'ZERO_COMMISSION' };
  }

  const effectiveCommissionCents = Math.abs(normalized.commissionCents);

  const resolvedNiche =
    niche ?? (network === 'binance' || network === 'bybit' ? 'crypto_global' : 'saas_global');

  if (db) {
    try {
      // 1. Write directly to Domain B immutable ledger (workspace_external_commissions)
      // Dedup on (tenant_id, network, external_tx_id, status) per migration 0480
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
          normalized.externalTxnId,
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

      // 2. Mark event recorded only after ledger write succeeds
      await db
        .prepare(
          `INSERT INTO commission_events (event_id, event_type, payload, processed)
           VALUES (?, ?, ?, 1)
           ON CONFLICT(event_id) DO UPDATE SET processed = 1`,
        )
        .bind(normalized.eventId, normalized.eventType, rawBody)
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
      return { success: false, eventId: normalized.eventId, network, commissionCents: 0, error: 'DB_WRITE_FAILED' };
    }
  }

  return {
    success: true,
    eventId: normalized.eventId,
    network,
    commissionCents: effectiveCommissionCents,
    platformFeeCents: 0,
    isIdempotentDuplicate: false,
  };
}
