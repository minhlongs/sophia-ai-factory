/**
 * affiliate-webhook-verifier.ts — Land Layer
 * Affiliate webhook verifier & multi-tier commission ledgering coordinator
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { calculatePartnerCommission } from '../affiliate-partner-service';
import type { AffiliatePartnerRow } from '@/seed/types/affiliate';
import type {
  VerifySignatureOptions,
  CommissionWebhookPayload,
  CommissionLedgerEntry,
  AffiliateCommissionLedgerResult,
} from './types';
import { verifyPostbackSignature } from './hmac-validator';
import { calculatePayableTimestamp, validateAntiFraudRules } from './replay-guard';
import { insertLedgerRecord } from './ledger-writer';

/**
 * Process and verify an inbound affiliate commission webhook, enforcing
 * 14-day hold and multi-tier commission ledgering.
 */
export async function processAffiliateCommissionWebhook(
  payload: CommissionWebhookPayload,
  verification?: VerifySignatureOptions
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

  const now = payload.timestamp ?? Date.now();
  const payableAt = calculatePayableTimestamp(now);
  const nowSec = Math.floor(now / 1000);
  const tenantId = payload.tenantId || 'sophia-global';
  const offerId = payload.offerId || 'sophia_subscription';
  const entries: CommissionLedgerEntry[] = [];

  const tier1Calc = calculatePartnerCommission({
    orderAmountCents: payload.orderAmountCents,
    activeSalesCount,
    isTier2: false,
    partnerTier: partnerRow.tier,
    customRatePct: Number(partnerRow.commission_rate_pct),
  });

  const tier1LedgerId = `led_t1_${payload.conversionEventId}`;
  await insertLedgerRecord({
    db,
    ledgerId: tier1LedgerId,
    tenantId,
    partnerId: partnerRow.id,
    conversionEventId: payload.conversionEventId,
    offerId,
    orderAmountCents: payload.orderAmountCents,
    ratePct: tier1Calc.ratePct,
    commissionCents: tier1Calc.commissionCents,
    payableAt,
    nowSec,
  });

  entries.push({
    ledgerId: tier1LedgerId,
    affiliateId: partnerRow.id,
    partnerCode: partnerRow.partner_code,
    tier: tier1Calc.tier,
    ratePct: tier1Calc.ratePct,
    commissionCents: tier1Calc.commissionCents,
    payableAt,
    status: 'pending',
    isTier2: false,
  });

  if (partnerRow.parent_partner_id) {
    const parentRow = await db
      .prepare('SELECT * FROM affiliate_partners WHERE id = ?')
      .bind(partnerRow.parent_partner_id)
      .first<AffiliatePartnerRow>();

    if (parentRow && parentRow.status === 'active') {
      const tier2Calc = calculatePartnerCommission({
        orderAmountCents: payload.orderAmountCents,
        activeSalesCount: 0,
        isTier2: true,
      });

      const tier2LedgerId = `led_t2_${payload.conversionEventId}`;
      await insertLedgerRecord({
        db,
        ledgerId: tier2LedgerId,
        tenantId,
        partnerId: parentRow.id,
        conversionEventId: `${payload.conversionEventId}_t2`,
        offerId,
        orderAmountCents: payload.orderAmountCents,
        ratePct: tier2Calc.ratePct,
        commissionCents: tier2Calc.commissionCents,
        payableAt,
        nowSec,
        parentConversionId: tier1LedgerId,
      });

      entries.push({
        ledgerId: tier2LedgerId,
        affiliateId: parentRow.id,
        partnerCode: parentRow.partner_code,
        tier: 'TIER2',
        ratePct: tier2Calc.ratePct,
        commissionCents: tier2Calc.commissionCents,
        payableAt,
        status: 'pending',
        isTier2: true,
      });
    }
  }

  logger.info('[AffiliateWebhookVerifier] Commission ledgered with 14-day hold', {
    conversionEventId: payload.conversionEventId,
    entriesCount: entries.length,
    payableAt: new Date(payableAt).toISOString(),
  });

  return { success: true, entries };
}
