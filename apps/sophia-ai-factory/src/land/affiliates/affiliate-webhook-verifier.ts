/**
 * Affiliate Webhook Verifier & Anti-Fraud Engine
 *
 * Implements HMAC-SHA256 signature verification for affiliate postbacks,
 * 14-day anti-fraud hold period enforcement (payable_at = timestamp + 14 * 86400 * 1000),
 * self-referral detection, and multi-tier commission ledgering.
 *
 * Layer: Land (business workflows, imports from seed, tree)
 *
 * @module land/affiliates/affiliate-webhook-verifier
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { verifyAffiliateHmac, type HmacAlgorithm } from '@/tree/affiliate/hmac-verifier';
import { calculatePartnerCommission } from './affiliate-partner-service';
import type { AffiliatePartnerRow } from '@/seed/types/affiliate';

export const HOLD_PERIOD_DAYS = 14;
export const HOLD_PERIOD_MS = 14 * 86400 * 1000; // Exactly 14 days in milliseconds

export interface VerifySignatureOptions {
  rawBody: string;
  signature: string;
  secret: string;
  algorithm?: HmacAlgorithm;
}

export interface AntiFraudCheckInput {
  partnerUserId: string;
  buyerUserId?: string;
  buyerEmail?: string;
  partnerEmail?: string;
  orderAmountCents: number;
}

export interface AntiFraudCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface CommissionWebhookPayload {
  conversionEventId: string;
  partnerCode: string;
  orderAmountCents: number;
  buyerUserId?: string;
  buyerEmail?: string;
  offerId?: string;
  tenantId?: string;
  timestamp?: number;
}

export interface CommissionLedgerEntry {
  ledgerId: string;
  affiliateId: string;
  partnerCode: string;
  tier: string;
  ratePct: number;
  commissionCents: number;
  payableAt: number;
  status: 'pending';
  isTier2: boolean;
}

export interface AffiliateCommissionLedgerResult {
  success: boolean;
  error?: string;
  fraudDetected?: boolean;
  entries?: CommissionLedgerEntry[];
}

/**
 * Enforce exactly 14 days hold before commission eligibility.
 */
export function calculatePayableTimestamp(attributedAtMs: number = Date.now()): number {
  return attributedAtMs + HOLD_PERIOD_MS;
}

/**
 * Verify HMAC-SHA256 postback signature.
 */
export async function verifyPostbackSignature(options: VerifySignatureOptions): Promise<boolean> {
  const { rawBody, signature, secret, algorithm = 'SHA-256' } = options;
  if (!rawBody || !signature || !secret) return false;
  return verifyAffiliateHmac(rawBody, signature, secret, algorithm);
}

/**
 * Validate anti-fraud rules including self-referral and zero-amount safeguards.
 */
export function validateAntiFraudRules(input: AntiFraudCheckInput): AntiFraudCheckResult {
  const { partnerUserId, buyerUserId, buyerEmail, partnerEmail, orderAmountCents } = input;

  // Rule 1: Order amount must be a positive finite number (guards against NaN, Infinity, <= 0)
  if (
    typeof orderAmountCents !== 'number' ||
    Number.isNaN(orderAmountCents) ||
    !Number.isFinite(orderAmountCents) ||
    orderAmountCents <= 0
  ) {
    return {
      allowed: false,
      reason: 'INVALID_ORDER_AMOUNT: Order amount must be strictly greater than 0.',
    };
  }

  // Rule 2: Self-referral detection by user ID
  if (buyerUserId && partnerUserId && buyerUserId.trim() === partnerUserId.trim()) {
    return {
      allowed: false,
      reason: 'SELF_REFERRAL_DETECTED: Partner user ID matches buyer user ID.',
    };
  }

  // Rule 3: Self-referral detection by email address
  if (buyerEmail && partnerEmail && buyerEmail.trim().toLowerCase() === partnerEmail.trim().toLowerCase()) {
    return {
      allowed: false,
      reason: 'SELF_REFERRAL_DETECTED: Partner email matches buyer email.',
    };
  }

  return { allowed: true };
}

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

  // 1. Verify HMAC signature if signature options provided
  if (verification) {
    const isValid = await verifyPostbackSignature(verification);
    if (!isValid) {
      logger.warn('[AffiliateWebhookVerifier] Invalid HMAC signature', {
        conversionEventId: payload.conversionEventId,
      });
      return { success: false, error: 'INVALID_SIGNATURE' };
    }
  }

  // 1.5 Idempotency check: verify if conversion event already processed
  const existingLedger = await db
    .prepare('SELECT id FROM commission_ledger WHERE conversion_event_id = ?')
    .bind(payload.conversionEventId)
    .first<{ id: string }>();

  if (existingLedger) {
    logger.info('[AffiliateWebhookVerifier] Duplicate conversion event skipped (idempotent)', {
      conversionEventId: payload.conversionEventId,
      existingLedgerId: existingLedger.id,
    });
    return {
      success: true,
      entries: [],
    };
  }

  // 2. Resolve partner by code
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

  // 3. Anti-fraud checks
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
    return {
      success: false,
      fraudDetected: true,
      error: fraudCheck.reason,
    };
  }

  // 4. Determine partner sales volume for tier escalations (>5 sales = 30%)
  const salesCountRes = await db
    .prepare('SELECT COUNT(*) as count FROM commission_ledger WHERE affiliate_id = ?')
    .bind(partnerRow.id)
    .first<{ count: number }>();
  const activeSalesCount = salesCountRes?.count ?? 0;

  // 5. Calculate 14-day hold period
  const now = payload.timestamp ?? Date.now();
  const payableAt = calculatePayableTimestamp(now);

  // 6. Calculate Tier 1 Direct Commission
  const tier1Calc = calculatePartnerCommission({
    orderAmountCents: payload.orderAmountCents,
    activeSalesCount,
    isTier2: false,
    partnerTier: partnerRow.tier,
    customRatePct: Number(partnerRow.commission_rate_pct),
  });

  const tenantId = payload.tenantId || 'sophia-global';
  const offerId = payload.offerId || 'sophia_subscription';
  const entries: CommissionLedgerEntry[] = [];

  const tier1LedgerId = `led_t1_${payload.conversionEventId}`;
  const nowSec = Math.floor(now / 1000);

  // Atomic insertion for Tier 1
  await db
    .prepare(
      `INSERT OR IGNORE INTO commission_ledger (
        id, tenant_id, affiliate_id, conversion_event_id, offer_id,
        gross_cents, commission_pct, commission_cents, withheld_cents,
        status, payable_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?)`
    )
    .bind(
      tier1LedgerId,
      tenantId,
      partnerRow.id,
      payload.conversionEventId,
      offerId,
      payload.orderAmountCents,
      tier1Calc.ratePct,
      tier1Calc.commissionCents,
      payableAt,
      nowSec,
      nowSec
    )
    .run();

  // Update partner pending balance
  await db
    .prepare(
      `UPDATE affiliate_partners
       SET pending_payout_cents = pending_payout_cents + ?,
           total_earnings_cents = total_earnings_cents + ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(tier1Calc.commissionCents, tier1Calc.commissionCents, now, partnerRow.id)
    .run();

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

  // 7. Calculate and insert Tier 2 override if parent partner exists
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

      await db
        .prepare(
          `INSERT OR IGNORE INTO commission_ledger (
            id, tenant_id, affiliate_id, conversion_event_id, offer_id,
            gross_cents, commission_pct, commission_cents, withheld_cents,
            parent_conversion_id, status, payable_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?, ?, ?)`
        )
        .bind(
          tier2LedgerId,
          tenantId,
          parentRow.id,
          `${payload.conversionEventId}_t2`,
          offerId,
          payload.orderAmountCents,
          tier2Calc.ratePct,
          tier2Calc.commissionCents,
          tier1LedgerId,
          payableAt,
          nowSec,
          nowSec
        )
        .run();

      await db
        .prepare(
          `UPDATE affiliate_partners
           SET pending_payout_cents = pending_payout_cents + ?,
               total_earnings_cents = total_earnings_cents + ?,
               updated_at = ?
           WHERE id = ?`
        )
        .bind(tier2Calc.commissionCents, tier2Calc.commissionCents, now, parentRow.id)
        .run();

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

  return {
    success: true,
    entries,
  };
}
