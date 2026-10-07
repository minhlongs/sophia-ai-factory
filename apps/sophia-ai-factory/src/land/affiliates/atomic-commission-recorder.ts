/**
 * Atomic Webhook Commission Recorder
 *
 * Reconciles incoming payment webhook events (NOWPayments / PayOS) into atomic
 * commission records in Cloudflare D1 with OCC and 14-day hold enforcement.
 *
 * Layer: land (affiliates domain workflow)
 * @module land/affiliates/atomic-commission-recorder
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface RecordCommissionWebhookParams {
  paymentProvider: 'nowpayments' | 'payos' | 'manual';
  paymentId: string;
  orderId?: string;
  customerUserId: string;
  grossAmountCents: number;
  partnerCode: string;
  subId?: string;
  currency?: 'USD' | 'VND';
}

export interface CommissionRecordResult {
  success: boolean;
  commissionId?: string;
  commissionCents?: number;
  alreadyRecorded?: boolean;
  error?: string;
}

const HOLD_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14-day anti-fraud rolling hold

export async function recordAtomicCommission(
  params: RecordCommissionWebhookParams
): Promise<CommissionRecordResult> {
  try {
    const db = await getD1();
    if (!db) {
      logger.warn('[commission-recorder] D1 unavailable, commission deferred', { paymentId: params.paymentId });
      return { success: false, error: 'Database unavailable' };
    }

    // Resolve partner details
    const partner = await db
      .prepare('SELECT id, commission_rate_pct, status FROM affiliate_partners WHERE partner_code = ?1 LIMIT 1')
      .bind(params.partnerCode)
      .first<{ id: string; commission_rate_pct: number; status: string }>();

    if (!partner || partner.status !== 'active') {
      logger.info('[commission-recorder] Inactive or unknown partner code', { partnerCode: params.partnerCode });
      return { success: false, error: 'Partner code not active' };
    }

    const ratePct = partner.commission_rate_pct ?? 20.0;
    const commissionCents = Math.round((params.grossAmountCents * ratePct) / 100);
    const eventKey = `comm_${params.paymentProvider}_${params.paymentId}`;
    const commissionId = `comm_${crypto.randomUUID().slice(0, 12)}`;
    const now = Date.now();
    const payableAt = now + HOLD_DURATION_MS;

    const metadata = JSON.stringify({
      subId: params.subId,
      orderId: params.orderId,
      grossAmountCents: params.grossAmountCents,
    });

    const result = await db
      .prepare(`INSERT INTO affiliate_commissions (
        id, event_key, partner_id, payment_provider, payment_id, order_id,
        customer_user_id, gross_amount_cents, commission_rate_pct, commission_cents,
        tier_level, currency, status, hold_days, payable_at, version,
        metadata_json, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'TIER1', ?11, 'pending', 14, ?12, 1, ?13, ?14, ?14)
      ON CONFLICT(event_key) DO NOTHING`)
      .bind(
        commissionId,
        eventKey,
        partner.id,
        params.paymentProvider,
        params.paymentId,
        params.orderId || null,
        params.customerUserId,
        params.grossAmountCents,
        ratePct,
        commissionCents,
        params.currency || 'USD',
        payableAt,
        metadata,
        now
      )
      .run();

    if ((result.meta?.changes ?? 0) === 0) {
      logger.info('[commission-recorder] Commission already recorded for event', { eventKey });
      return { success: true, alreadyRecorded: true, commissionCents };
    }

    // Atomically increment partner's pending payout cents
    await db
      .prepare('UPDATE affiliate_partners SET pending_payout_cents = pending_payout_cents + ?1, updated_at = ?2 WHERE id = ?3')
      .bind(commissionCents, now, partner.id)
      .run();

    logger.info('[commission-recorder] Commission recorded successfully', {
      commissionId,
      partnerId: partner.id,
      commissionCents,
    });

    return { success: true, commissionId, commissionCents, alreadyRecorded: false };
  } catch (err) {
    const error = toError(err);
    logger.error('[commission-recorder] Failed to record commission', { error: error.message });
    return { success: false, error: error.message };
  }
}
