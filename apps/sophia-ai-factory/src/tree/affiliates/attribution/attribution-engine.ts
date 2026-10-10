/**
 * Affiliate Attribution Engine Core Execution
 * Layer: tree (domain business logic, edge-compatible)
 *
 * @module tree/affiliates/attribution/attribution-engine
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AffiliateAttributionResult,
  AttributionParams,
} from '@/seed/types/affiliate';
import { DEFAULT_HOLD_DAYS, DEFAULT_COMMISSION_RATE_PCT } from './types';
import { resolveD1 } from './d1-resolver';
import { resolveReferrerPartner } from './cookie-parser';
import { calculatePayableAt, calculateCommissionCents, processTier2Commission } from './decay-calculator';
import { insertPrimaryCommissionRecord, updatePartnerAndReferralStatus } from './commission-writer';

/**
 * Executes idempotent commission attribution for a verified customer payment.
 */
export async function recordAffiliateCommission(
  params: AttributionParams,
  customD1?: D1Database,
): Promise<AffiliateAttributionResult> {
  const d1 = await resolveD1(customD1);
  if (!d1) {
    return { success: false, attributed: false, error: 'DATABASE_UNAVAILABLE' };
  }

  const primaryEventKey = `affiliate_comm_${params.provider}_${params.paymentId}`;

  try {
    const existing = await d1
      .prepare(`SELECT id FROM affiliate_commissions WHERE event_key = ?1 LIMIT 1`)
      .bind(primaryEventKey)
      .first<{ id: string }>();

    if (existing) {
      logger.info('[AffiliateAttribution] Payment event already attributed', {
        eventKey: primaryEventKey,
        existingId: existing.id,
      });
      return { success: true, attributed: false, commissionId: existing.id, reason: 'ALREADY_ATTRIBUTED' };
    }

    const { partner, referral } = await resolveReferrerPartner(d1, params);
    if (!partner) {
      return { success: true, attributed: false, reason: 'NO_ACTIVE_REFERRER' };
    }

    if (partner.user_id === params.customerId) {
      logger.warn('[AffiliateAttribution] Self-referral detected and disallowed', {
        partnerId: partner.id,
        customerId: params.customerId,
      });
      return { success: true, attributed: false, partnerId: partner.id, reason: 'SELF_REFERRAL_DISALLOWED' };
    }

    const ratePct = partner.custom_rate_override_pct ?? partner.commission_rate_pct ?? DEFAULT_COMMISSION_RATE_PCT;
    const commissionCents = calculateCommissionCents(params.grossAmountCents, ratePct);

    if (commissionCents <= 0) {
      return { success: true, attributed: false, partnerId: partner.id, reason: 'ZERO_COMMISSION' };
    }

    const nowMs = Date.now();
    const holdDays = DEFAULT_HOLD_DAYS;
    const payableAt = calculatePayableAt(nowMs, holdDays);
    const primaryCommissionId = `comm_${crypto.randomUUID().replace(/-/g, '')}`;
    const currency = params.currency ?? 'USD';

    const inserted = await insertPrimaryCommissionRecord({
      d1,
      primaryCommissionId,
      primaryEventKey,
      partner,
      referral,
      params,
      ratePct,
      commissionCents,
      currency,
      holdDays,
      payableAt,
      nowMs,
    });

    if (!inserted) {
      return { success: true, attributed: false, reason: 'ALREADY_ATTRIBUTED' };
    }

    await updatePartnerAndReferralStatus(d1, partner.id, commissionCents, referral?.id, nowMs);

    logger.info('[AffiliateAttribution] Commission attributed successfully', {
      commissionId: primaryCommissionId,
      partnerId: partner.id,
      amountCents: commissionCents,
      provider: params.provider,
      paymentId: params.paymentId,
    });

    let tier2CommissionId: string | undefined;
    if (partner.parent_partner_id) {
      tier2CommissionId = await processTier2Commission({
        d1,
        partner,
        parentPartnerId: partner.parent_partner_id,
        customerId: params.customerId,
        grossAmountCents: params.grossAmountCents,
        referralId: referral?.id ?? null,
        provider: params.provider,
        paymentId: params.paymentId,
        orderId: params.orderId,
        currency,
        holdDays,
        payableAt,
        primaryEventKey,
        nowMs,
      });
    }

    return {
      success: true,
      attributed: true,
      commissionId: primaryCommissionId,
      tier2CommissionId,
      commissionCents,
      partnerId: partner.id,
    };
  } catch (err) {
    logger.error('[AffiliateAttribution] Error during commission attribution', {
      params,
      error: String(err),
    });
    return { success: false, attributed: false, error: String(err) };
  }
}

/**
 * Non-blocking wrapper for commission attribution.
 * Logs any uncaught exceptions and guarantees payment processing flows are never halted.
 */
export async function safelyRecordAffiliateCommission(
  params: AttributionParams,
  customD1?: D1Database,
): Promise<AffiliateAttributionResult> {
  try {
    return await recordAffiliateCommission(params, customD1);
  } catch (err) {
    logger.warn('[AffiliateAttribution] Safely caught attribution exception', {
      provider: params.provider,
      paymentId: params.paymentId,
      error: String(err),
    });
    return { success: false, attributed: false, error: String(err) };
  }
}
