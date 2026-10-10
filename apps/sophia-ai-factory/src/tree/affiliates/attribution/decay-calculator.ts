/**
 * Tier-2 and Hold/Decay Calculator for Affiliate Attribution
 * Layer: tree (domain business logic, edge-compatible)
 *
 * @module tree/affiliates/attribution/decay-calculator
 */

import type { AffiliatePartnerRow } from '@/seed/types/affiliate';
import { logger } from '@/seed/utils/logger-utility';
import type { Tier2AttributionInput } from './types';
import { DEFAULT_TIER2_RATE_PCT } from './types';

/**
 * Calculates hold expiration timestamp (epoch ms) from start time and hold window.
 */
export function calculatePayableAt(nowMs: number, holdDays: number): number {
  return nowMs + holdDays * 86400 * 1000;
}

/**
 * Calculates commission amount in cents given gross cents and rate percentage.
 */
export function calculateCommissionCents(grossAmountCents: number, ratePct: number): number {
  return Math.round(grossAmountCents * (ratePct / 100));
}

/**
 * Processes Tier-2 parent partner override commission if parent partner exists and is distinct from customer.
 */
export async function processTier2Commission(p: Tier2AttributionInput): Promise<string | undefined> {
  const parentPartner = await p.d1
    .prepare(`SELECT * FROM affiliate_partners WHERE id = ?1 AND status = 'active' LIMIT 1`)
    .bind(p.parentPartnerId)
    .first<AffiliatePartnerRow>()
    .catch(() => null);

  if (!parentPartner || parentPartner.user_id === p.customerId) {
    return undefined;
  }

  const tier2RatePct = p.partner.tier2_rate_pct ?? DEFAULT_TIER2_RATE_PCT;
  const tier2AmountCents = calculateCommissionCents(p.grossAmountCents, tier2RatePct);
  if (tier2AmountCents <= 0) return undefined;

  const tier2CommissionId = `comm_t2_${crypto.randomUUID().replace(/-/g, '')}`;
  const tier2EventKey = `${p.primaryEventKey}_tier2`;

  const t2Res = await p.d1
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
      p.referralId,
      p.provider,
      p.paymentId,
      p.orderId ?? null,
      p.customerId,
      p.grossAmountCents,
      tier2RatePct,
      tier2AmountCents,
      p.currency,
      p.holdDays,
      p.payableAt,
      JSON.stringify({ tier1PartnerId: p.partner.id, tier2RatePct }),
      p.nowMs,
      p.nowMs
    )
    .run();

  if ((t2Res.meta?.changes ?? 0) > 0) {
    await p.d1
      .prepare(
        `UPDATE affiliate_partners
         SET pending_payout_cents = pending_payout_cents + ?1,
             total_earnings_cents = total_earnings_cents + ?1,
             updated_at = ?2
         WHERE id = ?3`
      )
      .bind(tier2AmountCents, p.nowMs, parentPartner.id)
      .run();

    logger.info('[AffiliateAttribution] Tier 2 parent commission attributed', {
      tier2CommissionId,
      parentPartnerId: parentPartner.id,
      amountCents: tier2AmountCents,
    });
  }

  return tier2CommissionId;
}
