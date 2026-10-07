/**
 * Affiliate Attribution Engine
 *
 * Provides atomic, idempotent attribution of commissions when customer payments
 * settle on NOWPayments (USDT) or PayOS (VietQR).
 *
 * Guarantees:
 * 1. Single-credit idempotency via unique event_key: `affiliate_comm_${provider}_${payment_id}`.
 * 2. Self-referral protection (users cannot earn commissions on their own payments).
 * 3. 2-Tier commission distribution (parent partner override).
 * 4. Non-blocking wrapper `safelyRecordAffiliateCommission` that catches all errors and logs without throwing.
 *
 * Layer: tree (domain business logic, edge-compatible, zero forest/land imports).
 *
 * @module tree/affiliates/affiliate-attribution
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AffiliateAttributionResult,
  AttributionParams,
  AffiliatePartnerRow,
  AffiliateReferralRow,
} from '@/seed/types/affiliate';

/**
 * Resolves Cloudflare D1 database instance.
 */
async function resolveD1(customD1?: D1Database): Promise<D1Database | null> {
  if (customD1) return customD1;
  try {
    return await getD1Raw();
  } catch (err) {
    logger.warn('[AffiliateAttribution] Failed to resolve D1 database', { error: String(err) });
    return null;
  }
}

/**
 * Executes idempotent commission attribution for a verified customer payment.
 */
export async function recordAffiliateCommission(
  params: AttributionParams,
  customD1?: D1Database
): Promise<AffiliateAttributionResult> {
  const d1 = await resolveD1(customD1);
  if (!d1) {
    return {
      success: false,
      attributed: false,
      error: 'DATABASE_UNAVAILABLE',
    };
  }

  const primaryEventKey = `affiliate_comm_${params.provider}_${params.paymentId}`;

  try {
    // 1. Idempotency Check: verify if commission has already been recorded
    const existing = await d1
      .prepare(`SELECT id FROM affiliate_commissions WHERE event_key = ?1 LIMIT 1`)
      .bind(primaryEventKey)
      .first<{ id: string }>();

    if (existing) {
      logger.info('[AffiliateAttribution] Payment event already attributed', {
        eventKey: primaryEventKey,
        existingId: existing.id,
      });
      return {
        success: true,
        attributed: false,
        commissionId: existing.id,
        reason: 'ALREADY_ATTRIBUTED',
      };
    }

    // 2. Referrer Resolution
    let partner: AffiliatePartnerRow | null = null;
    let referral: AffiliateReferralRow | null = null;

    // A. Explicit partner code override passed in params
    if (params.partnerCodeOverride) {
      partner = await d1
        .prepare(`SELECT * FROM affiliate_partners WHERE partner_code = ?1 AND status = 'active' LIMIT 1`)
        .bind(params.partnerCodeOverride)
        .first<AffiliatePartnerRow>();
    }

    // B. Referral binding table check
    if (!partner && params.customerId) {
      referral = await d1
        .prepare(
          `SELECT * FROM affiliate_referrals
           WHERE referred_user_id = ?1 AND status IN ('pending', 'converted')
           ORDER BY created_at DESC LIMIT 1`
        )
        .bind(params.customerId)
        .first<AffiliateReferralRow>();

      if (referral) {
        partner = await d1
          .prepare(`SELECT * FROM affiliate_partners WHERE id = ?1 AND status = 'active' LIMIT 1`)
          .bind(referral.partner_id)
          .first<AffiliatePartnerRow>();
      }
    }

    // C. Pending order referral / promo code fallback
    if (!partner && params.orderId) {
      const order = await d1
        .prepare(`SELECT promo_code FROM pending_orders WHERE order_id = ?1 LIMIT 1`)
        .bind(params.orderId)
        .first<{ promo_code?: string | null }>()
        .catch(() => null);

      if (order?.promo_code) {
        partner = await d1
          .prepare(`SELECT * FROM affiliate_partners WHERE (partner_code = ?1 OR id = ?1) AND status = 'active' LIMIT 1`)
          .bind(order.promo_code)
          .first<AffiliatePartnerRow>()
          .catch(() => null);
      }
    }

    // D. User profile settings fallback (referred_by)
    if (!partner && params.customerId) {
      const userProfile = await d1
        .prepare(`SELECT settings FROM user_profiles WHERE user_id = ?1 LIMIT 1`)
        .bind(params.customerId)
        .first<{ settings?: string | null }>()
        .catch(() => null);

      if (userProfile?.settings) {
        try {
          const settings = (typeof userProfile.settings === 'string'
            ? JSON.parse(userProfile.settings)
            : userProfile.settings) as Record<string, unknown>;
          const referredBy = settings.referred_by as string | undefined;
          if (referredBy) {
            partner = await d1
              .prepare(
                `SELECT * FROM affiliate_partners
                 WHERE (partner_code = ?1 OR user_id = ?1 OR id = ?1) AND status = 'active'
                 LIMIT 1`
              )
              .bind(referredBy)
              .first<AffiliatePartnerRow>()
              .catch(() => null);
          }
        } catch {
          // ignore json parse errors
        }
      }
    }

    // If no active affiliate partner is associated with this customer
    if (!partner) {
      return {
        success: true,
        attributed: false,
        reason: 'NO_ACTIVE_REFERRER',
      };
    }

    // 3. Self-Referral Prevention: Partner cannot earn on their own account purchases
    if (partner.user_id === params.customerId) {
      logger.warn('[AffiliateAttribution] Self-referral detected and disallowed', {
        partnerId: partner.id,
        customerId: params.customerId,
      });
      return {
        success: true,
        attributed: false,
        partnerId: partner.id,
        reason: 'SELF_REFERRAL_DISALLOWED',
      };
    }

    // 4. Commission Calculation (Tier 1)
    const ratePct = partner.custom_rate_override_pct ?? partner.commission_rate_pct ?? 20.0;
    const commissionCents = Math.round(params.grossAmountCents * (ratePct / 100));

    if (commissionCents <= 0) {
      return {
        success: true,
        attributed: false,
        partnerId: partner.id,
        reason: 'ZERO_COMMISSION',
      };
    }

    const nowMs = Date.now();
    const holdDays = 14;
    const payableAt = nowMs + holdDays * 86400 * 1000;
    const primaryCommissionId = `comm_${crypto.randomUUID().replace(/-/g, '')}`;
    const currency = params.currency ?? 'USD';

    // 5. Atomic Insertion of Tier 1 Commission with ON CONFLICT DO NOTHING
    const insertRes = await d1
      .prepare(
        `INSERT INTO affiliate_commissions (
           id, event_key, partner_id, referral_id, payment_provider, payment_id,
           order_id, customer_user_id, gross_amount_cents, commission_rate_pct,
           commission_cents, tier_level, currency, status, hold_days, payable_at,
           version, metadata_json, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TIER1', ?, 'pending', ?, ?, 1, ?, ?, ?)
         ON CONFLICT(event_key) DO NOTHING`
      )
      .bind(
        primaryCommissionId,
        primaryEventKey,
        partner.id,
        referral?.id ?? null,
        params.provider,
        params.paymentId,
        params.orderId ?? null,
        params.customerId,
        params.grossAmountCents,
        ratePct,
        commissionCents,
        currency,
        holdDays,
        payableAt,
        JSON.stringify({ grossAmountCents: params.grossAmountCents, ratePct }),
        nowMs,
        nowMs
      )
      .run();

    const changes = insertRes.meta?.changes ?? 0;
    if (changes === 0) {
      // Conflict caught atomically by unique event_key
      return {
        success: true,
        attributed: false,
        reason: 'ALREADY_ATTRIBUTED',
      };
    }

    // Update partner balances and referral conversion status
    const postInsertBatch = [
      d1
        .prepare(
          `UPDATE affiliate_partners
           SET pending_payout_cents = pending_payout_cents + ?1,
               total_earnings_cents = total_earnings_cents + ?1,
               updated_at = ?2
           WHERE id = ?3`
        )
        .bind(commissionCents, nowMs, partner.id),
    ];

    if (referral?.id) {
      postInsertBatch.push(
        d1
          .prepare(
            `UPDATE affiliate_referrals
             SET status = 'converted', converted_at = ?1, updated_at = ?1
             WHERE id = ?2`
          )
          .bind(nowMs, referral.id)
      );
    }

    await d1.batch(postInsertBatch);

    logger.info('[AffiliateAttribution] Commission attributed successfully', {
      commissionId: primaryCommissionId,
      partnerId: partner.id,
      amountCents: commissionCents,
      provider: params.provider,
      paymentId: params.paymentId,
    });

    // 6. Tier 2 Parent Partner Commission (if applicable)
    let tier2CommissionId: string | undefined;

    if (partner.parent_partner_id) {
      const parentPartner = await d1
        .prepare(`SELECT * FROM affiliate_partners WHERE id = ?1 AND status = 'active' LIMIT 1`)
        .bind(partner.parent_partner_id)
        .first<AffiliatePartnerRow>()
        .catch(() => null);

      if (parentPartner && parentPartner.user_id !== params.customerId) {
        const tier2RatePct = partner.tier2_rate_pct ?? 5.0;
        const tier2AmountCents = Math.round(params.grossAmountCents * (tier2RatePct / 100));

        if (tier2AmountCents > 0) {
          tier2CommissionId = `comm_t2_${crypto.randomUUID().replace(/-/g, '')}`;
          const tier2EventKey = `${primaryEventKey}_tier2`;

          const t2Res = await d1
            .prepare(
              `INSERT INTO affiliate_commissions (
                 id, event_key, partner_id, referral_id, payment_provider, payment_id,
                 order_id, customer_user_id, gross_amount_cents, commission_rate_pct,
                 commission_cents, tier_level, currency, status, hold_days, payable_at,
                 version, metadata_json, created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TIER2', ?, 'pending', ?, ?, 1, ?, ?, ?)
               ON CONFLICT(event_key) DO NOTHING`
            )
            .bind(
              tier2CommissionId,
              tier2EventKey,
              parentPartner.id,
              referral?.id ?? null,
              params.provider,
              params.paymentId,
              params.orderId ?? null,
              params.customerId,
              params.grossAmountCents,
              tier2RatePct,
              tier2AmountCents,
              currency,
              holdDays,
              payableAt,
              JSON.stringify({ tier1PartnerId: partner.id, tier2RatePct }),
              nowMs,
              nowMs
            )
            .run();

          if ((t2Res.meta?.changes ?? 0) > 0) {
            await d1
              .prepare(
                `UPDATE affiliate_partners
                 SET pending_payout_cents = pending_payout_cents + ?1,
                     total_earnings_cents = total_earnings_cents + ?1,
                     updated_at = ?2
                 WHERE id = ?3`
              )
              .bind(tier2AmountCents, nowMs, parentPartner.id)
              .run();

            logger.info('[AffiliateAttribution] Tier 2 parent commission attributed', {
              tier2CommissionId,
              parentPartnerId: parentPartner.id,
              amountCents: tier2AmountCents,
            });
          }
        }
      }
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
    return {
      success: false,
      attributed: false,
      error: String(err),
    };
  }
}

/**
 * Non-blocking wrapper for commission attribution.
 * Logs any uncaught exceptions and guarantees payment processing flows are never halted.
 */
export async function safelyRecordAffiliateCommission(
  params: AttributionParams,
  customD1?: D1Database
): Promise<AffiliateAttributionResult> {
  try {
    return await recordAffiliateCommission(params, customD1);
  } catch (err) {
    logger.warn('[AffiliateAttribution] Safely caught attribution exception', {
      provider: params.provider,
      paymentId: params.paymentId,
      error: String(err),
    });
    return {
      success: false,
      attributed: false,
      error: String(err),
    };
  }
}
