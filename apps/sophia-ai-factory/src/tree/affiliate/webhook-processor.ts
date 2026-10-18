/**
 * Affiliate Webhook Processor Engine
 * Pure Domain Layer (Tree)
 *
 * Coordinates timing-safe HMAC verification, multi-network payload parsing,
 * sub-ID attribution, commission validation, and atomic ledger insertion
 * with a 14-day anti-fraud clawback hold.
 *
 * @module tree/affiliate/webhook-processor
 */

import { verifyAffiliateHmac, type HmacAlgorithm } from './hmac-verifier';
import { parseAffiliateSubId, type AffiliateNetwork } from './attribution-parser';
import { recordCommissionEntry } from './commission-ledger';
import { extractWebhookMoneyValues } from './webhook-payload-extractor';

export interface WebhookProcessingResult {
  success: boolean;
  error?: string;
  conversionId?: string;
  affiliateId?: string;
  commissionCents?: number;
  payableAt?: number;
  network?: AffiliateNetwork;
  subId?: string;
  campaignId?: string;
}

export interface ProcessWebhookOptions {
  db: D1Database;
  network: AffiliateNetwork;
  rawBody: string;
  signature: string;
  secret: string;
  algorithm?: HmacAlgorithm;
  nowMs?: number;
}

/**
 * Validates and ingests conversion webhooks across all 5 affiliate networks.
 */
export async function processAffiliateWebhook(
  options: ProcessWebhookOptions,
): Promise<WebhookProcessingResult> {
  const {
    db,
    network,
    rawBody,
    signature,
    secret,
    algorithm = 'SHA-256',
    nowMs = Date.now(),
  } = options;

  // 1. Timing-safe HMAC verification
  const isValid = await verifyAffiliateHmac(rawBody, signature, secret, algorithm);
  if (!isValid) {
    return { success: false, error: 'INVALID_HMAC_SIGNATURE' };
  }

  // 2. Parse JSON payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { success: false, error: 'MALFORMED_JSON_PAYLOAD' };
  }

  // 3. Extract attribution details
  const attribution = parseAffiliateSubId({ network, payload }, network);

  // 4. Resolve conversion ID & money values
  const { conversionId, commissionCents, orderValueCents } = extractWebhookMoneyValues(
    payload,
    network,
    attribution.orderId,
  );

  // 5. Commission validation rule: must be strictly positive
  if (commissionCents <= 0) {
    return { success: false, error: 'ZERO_OR_NEGATIVE_COMMISSION' };
  }

  // 6. 14-day anti-fraud hold rule: payable_at = attributed_at + 14 * 86400 * 1000
  const holdMs = 14 * 86400 * 1000;
  const payableAt = nowMs + holdMs;
  const affiliateId = attribution.affiliateUserId;

  // 7. Atomic D1 insertion via commission-ledger
  const ledgerResult = await recordCommissionEntry(
    db,
    {
      affiliateId,
      network,
      externalConversionId: conversionId,
      subId: attribution.rawSubId,
      orderValueCents,
      commissionCents,
      holdDays: 14,
      attributedAt: nowMs,
      payableAt,
    },
    nowMs,
  );

  if (!ledgerResult.success) {
    return {
      success: false,
      error: ledgerResult.error ?? 'DATABASE_INSERT_FAILED',
    };
  }

  return {
    success: true,
    conversionId,
    affiliateId,
    commissionCents,
    payableAt,
    network,
    subId: attribution.rawSubId ?? undefined,
    campaignId: attribution.campaignId ?? undefined,
  };
}
