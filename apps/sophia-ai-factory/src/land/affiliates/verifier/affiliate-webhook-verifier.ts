/**
 * affiliate-webhook-verifier.ts — Land Layer
 * Affiliate webhook verifier & multi-tier commission ledgering coordinator
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { AffiliatePartnerRow } from '@/seed/types/affiliate';
import type {
  VerifySignatureOptions,
  CommissionWebhookPayload,
  AffiliateCommissionLedgerResult,
} from './types';
import { verifyPostbackSignature } from './hmac-validator';
import { validateAntiFraudRules } from './replay-guard';
import { recordTieredCommissionEntries } from './affiliate-ledger-recorder';

/**
 * Process and verify an inbound affiliate commission webhook, enforcing
 * 14-day hold and multi-tier commission ledgering.
 */
export async function processAffiliateCommissionWebhook(
  payload: CommissionWebhookPayload,
  verification?: VerifySignatureOptions,
): Promise<AffiliateCommissionLedgerResult> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  if (verification) {
    const isValid = await verifyPostbackSignature(verification);
    if (!isValid) {
      logger.warn('[AffiliateWebhookVerifier] Invalid HMAC signature', {
        conversionEventId: payload.conversionEventId,
      });
      return { success: false, error: 'INVALID_SIGNATURE' };
    }
  }

  const existingLedger = await db
    .prepare('SELECT id FROM commission_ledger WHERE conversion_event_id = ?')
    .bind(payload.conversionEventId)
    .first<{ id: string }>();

  if (existingLedger) {
    logger.info('[AffiliateWebhookVerifier] Duplicate conversion event skipped (idempotent)', {
      conversionEventId: payload.conversionEventId,
      existingLedgerId: existingLedger.id,
    });
    return { success: true, entries: [] };
  }

  const partnerRow = await db
    .prepare('SELECT * FROM affiliate_partners WHERE partner_code = ?')
    .bind(payload.partnerCode.toUpperCase().trim())
    .first<AffiliatePartnerRow>();

  if (!partnerRow) {
    logger.warn('[AffiliateWebhookVerifier] Partner code not found', {
      partnerCode: payload.partnerCode,
    });
    return { success: false, error: 'PARTNER_NOT_FOUND' };
  }

  if (partnerRow.status !== 'active') {
    logger.warn('[AffiliateWebhookVerifier] Partner is not active', {
      partnerId: partnerRow.id,
      status: partnerRow.status,
    });
    return { success: false, error: 'PARTNER_INACTIVE' };
  }

  const fraudCheck = validateAntiFraudRules({
    partnerUserId: partnerRow.user_id,
    buyerUserId: payload.buyerUserId,
    buyerEmail: payload.buyerEmail,
    orderAmountCents: payload.orderAmountCents,
  });

  if (!fraudCheck.allowed) {
    logger.warn('[AffiliateWebhookVerifier] Anti-fraud check failed', {
      partnerId: partnerRow.id,
      reason: fraudCheck.reason,
    });
    return { success: false, fraudDetected: true, error: fraudCheck.reason };
  }

  const salesCountRes = await db
    .prepare('SELECT COUNT(*) as count FROM commission_ledger WHERE affiliate_id = ?')
    .bind(partnerRow.id)
    .first<{ count: number }>();
  const activeSalesCount = salesCountRes?.count ?? 0;

  const { entries, payableAt } = await recordTieredCommissionEntries({
    db,
    partnerRow,
    payload,
    activeSalesCount,
  });

  logger.info('[AffiliateWebhookVerifier] Commission ledgered with 14-day hold', {
    conversionEventId: payload.conversionEventId,
    entriesCount: entries.length,
    payableAt: new Date(payableAt).toISOString(),
  });

  return { success: true, entries };
}
