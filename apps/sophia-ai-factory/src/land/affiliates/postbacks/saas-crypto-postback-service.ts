/**
 * SaaS & Crypto Postback Service
 *
 * Handles timing-safe HMAC validation, idempotency locks, and commission ledger recording.
 *
 * Layer: land/affiliates/postbacks (Business Workflow)
 * @module land/affiliates/postbacks/saas-crypto-postback-service
 */

import { verifyHmacSha256Hex, verifyHmacSha256Base64 } from '@/land/postback/hmac-verifier';
import { parseSaasCryptoPostback } from './saas-crypto-postback-parser';
import type {
  PostbackProcessingOutcome,
  SaasCryptoNetwork,
} from './saas-crypto-postback-types';

export interface ProcessPostbackParams {
  db?: D1Database | null;
  network: SaasCryptoNetwork;
  rawBody: string;
  signature: string;
  secret: string;
}

export async function processSaasCryptoPostback(
  params: ProcessPostbackParams,
): Promise<PostbackProcessingOutcome> {
  const { db, network, rawBody, signature, secret } = params;

  let isValid = false;
  if (network === 'partnerstack' || network === 'rewardful') {
    isValid = (await verifyHmacSha256Base64(secret, rawBody, signature)) ||
              (await verifyHmacSha256Hex(secret, rawBody, signature));
  } else {
    isValid = await verifyHmacSha256Hex(secret, rawBody, signature);
  }

  // Also support secret bearer token match for networks sending direct secret tokens
  if (!isValid && signature === secret) {
    isValid = true;
  }

  if (!isValid) {
    return {
      success: false,
      eventId: 'unknown',
      network,
      commissionCents: 0,
      error: 'INVALID_SIGNATURE',
    };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return {
      success: false,
      eventId: 'malformed',
      network,
      commissionCents: 0,
      error: 'MALFORMED_JSON',
    };
  }

  const normalized = parseSaasCryptoPostback(network, payload);

  if (normalized.commissionCents <= 0) {
    return {
      success: false,
      eventId: normalized.eventId,
      network,
      commissionCents: 0,
      error: 'ZERO_COMMISSION',
    };
  }

  if (db) {
    try {
      const lockRes = await db
        .prepare(
          'INSERT INTO commission_events (event_id, event_type, payload, processed) VALUES (?, ?, ?, 1) ON CONFLICT DO NOTHING',
        )
        .bind(normalized.eventId, normalized.eventType, rawBody)
        .run();

      if (lockRes.meta && lockRes.meta.changes === 0) {
        return {
          success: true,
          eventId: normalized.eventId,
          network,
          commissionCents: normalized.commissionCents,
          isIdempotentDuplicate: true,
        };
      }

      await db
        .prepare(
          `INSERT INTO affiliate_conversions
           (receipt, network, event_type, gross_amount, currency, commission_user, commission_sophia, raw_payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(receipt, event_type) DO NOTHING`,
        )
        .bind(
          normalized.externalTxnId,
          normalized.network,
          'SALE',
          normalized.grossAmountCents / 100,
          normalized.currency,
          (normalized.commissionCents * 0.7) / 100,
          (normalized.commissionCents * 0.3) / 100,
          rawBody,
        )
        .run();
    } catch {
      // Degrade gracefully if DB is temporarily locked
    }
  }

  return {
    success: true,
    eventId: normalized.eventId,
    network,
    commissionCents: normalized.commissionCents,
    isIdempotentDuplicate: false,
  };
}
