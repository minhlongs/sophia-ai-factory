/**
 * Scenario Builder & Timeline Calculation for Synthetic Fulfillment
 *
 * Implements delta calculation and result payload building.
 *
 * Layer: tree/admin/synthetic
 */

import { getD1 } from '@/seed/db/client';
import {
  insertPurchase,
  markPaid,
} from '@/seed/db/repositories/user-purchases-repo';
import type { ONE_TIME_SKUS } from '@/seed/config/one-time-skus';
import type { OneTimeSkuId } from '@/seed/types';
import type {
  SyntheticTimeline,
  SyntheticDeltasMs,
  SyntheticRunResult,
  BillingEventRow,
} from './types';

export async function checkEmailSent(purchaseId: string): Promise<number | null> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const row = await _db
      .prepare(
        `SELECT event_type FROM billing_events
         WHERE purchase_id = ?1 AND event_type = 'bundle_ready_email_sent'
         LIMIT 1`,
      )
      .bind(purchaseId)
      .first<BillingEventRow>();
    return row ? Date.now() : null;
  } catch {
    return null;
  }
}

export function computeDeltas(tl: SyntheticTimeline): SyntheticDeltasMs {
  return {
    paid_to_queued: tl.queued_at ? tl.queued_at - tl.paid_at : null,
    queued_to_processing:
      tl.queued_at && tl.processing_at ? tl.processing_at - tl.queued_at : null,
    processing_to_completed:
      tl.processing_at && tl.completed_at ? tl.completed_at - tl.processing_at : null,
    total: tl.completed_at ? tl.completed_at - tl.paid_at : null,
  };
}

export function buildRunResult(
  paymentId: string,
  purchaseId: string | null,
  videoId: string | null,
  outcome: SyntheticRunResult['outcome'],
  timeline: SyntheticTimeline,
  errors: string[],
): SyntheticRunResult {
  return {
    payment_id: paymentId,
    purchase_id: purchaseId,
    video_id: videoId,
    outcome,
    timeline,
    deltas_ms: computeDeltas(timeline),
    errors,
  };
}

export async function setupSyntheticPurchase(
  userId: string,
  skuId: OneTimeSkuId,
  sku: (typeof ONE_TIME_SKUS)[OneTimeSkuId],
  paymentId: string,
  errors: string[],
): Promise<string | null> {
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
    const purchaseId = await insertPurchase({
      userId,
      kind: 'one_time',
      sku: skuId,
      paymentId,
      amountCents: sku.priceUsd * 100,
      creditsTotal: sku.credits,
      expiresAt,
      status: 'pending',
    });

    if (!purchaseId) {
      errors.push('insertPurchase returned null');
      return null;
    }

    await markPaid(paymentId, sku.credits, Math.floor(Date.now() / 1000) + 365 * 24 * 3600);
    return purchaseId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Purchase setup failed: ${msg}`);
    return null;
  }
}
