/**
 * Commission D1 Persistence and Balance Updates
 * Layer: tree (domain business logic, edge-compatible)
 *
 * @module tree/affiliates/attribution/commission-writer
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { AttributionParams, AffiliatePartnerRow, AffiliateReferralRow } from './types';

export interface InsertCommissionRecordParams {
  d1: D1Database;
  primaryCommissionId: string;
  primaryEventKey: string;
  partner: AffiliatePartnerRow;
  referral: AffiliateReferralRow | null;
  params: AttributionParams;
  ratePct: number;
  commissionCents: number;
  currency: string;
  holdDays: number;
  payableAt: number;
  nowMs: number;
}

/**
 * Inserts primary commission with atomic ON CONFLICT(event_key) DO NOTHING.
 * Returns true if inserted, false if already exists (changes === 0).
 */
export async function insertPrimaryCommissionRecord(p: InsertCommissionRecordParams): Promise<boolean> {
  const insertRes = await p.d1
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
      p.primaryCommissionId,
      p.primaryEventKey,
      p.partner.id,
      p.referral?.id ?? null,
      p.params.provider,
      p.params.paymentId,
      p.params.orderId ?? null,
      p.params.customerId,
      p.params.grossAmountCents,
      p.ratePct,
      p.commissionCents,
      p.currency,
      p.holdDays,
      p.payableAt,
      JSON.stringify({ grossAmountCents: p.params.grossAmountCents, ratePct: p.ratePct }),
      p.nowMs,
      p.nowMs
    )
    .run();

  const changes = insertRes.meta?.changes ?? 0;
  return changes > 0;
}

/**
 * Updates affiliate partner earnings/pending balance and marks referral as converted.
 */
export async function updatePartnerAndReferralStatus(
  d1: D1Database,
  partnerId: string,
  commissionCents: number,
  referralId: string | null | undefined,
  nowMs: number,
): Promise<void> {
  const postInsertBatch = [
    d1
      .prepare(
        `UPDATE affiliate_partners
         SET pending_payout_cents = pending_payout_cents + ?1,
             total_earnings_cents = total_earnings_cents + ?1,
             updated_at = ?2
         WHERE id = ?3`
      )
      .bind(commissionCents, nowMs, partnerId),
  ];

  if (referralId) {
    postInsertBatch.push(
      d1
        .prepare(
          `UPDATE affiliate_referrals
           SET status = 'converted', converted_at = ?1, updated_at = ?1
           WHERE id = ?2`
        )
        .bind(nowMs, referralId)
    );
  }

  await d1.batch(postInsertBatch);
}
