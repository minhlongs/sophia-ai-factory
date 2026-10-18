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
import { DEFAULT_COMMISSION_RATE_PCT } from './types';
import { resolveD1 } from './d1-resolver';
import { resolveReferrerPartner } from './cookie-parser';
import { calculateCommissionCents } from './decay-calculator';
import { persistValidatedCommission } from './attribution-execution-helpers';

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

    return await persistValidatedCommission({
      d1,
      primaryEventKey,
      partner,
      referral,
      params,
      ratePct,
      commissionCents,
    });
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
