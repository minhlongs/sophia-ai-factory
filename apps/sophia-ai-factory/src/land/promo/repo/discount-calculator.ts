/**
 * Promo discount redemptions & atomic operations
 * @module land/promo/repo/discount-calculator
 */

import { getD1 } from '@/seed/db/client';
import type { RedemptionRow, IncrementAndRecordInput, RecordRedemptionInput } from './types';

function genId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export async function incrementUsedCount(codeId: string): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  await db
    .prepare(`UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?1`)
    .bind(codeId)
    .run();
}

export async function incrementAndRecord(input: IncrementAndRecordInput): Promise<RedemptionRow> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const id = genId();
  const nowSec = Math.floor(Date.now() / 1000);
  const status = input.status ?? 'redeemed';

  const incrementStmt = db
    .prepare(`UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?1`)
    .bind(input.codeId);

  const insertStmt = db
    .prepare(
      `INSERT INTO promo_code_redemptions
       (id, promo_code_id, promo_code, user_id, email, applied_to_tier, applied_to_sku,
        discount_applied_cents, trial_days_granted, redeemed_at, payment_id, handover_id, status)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`,
    )
    .bind(
      id,
      input.codeId,
      input.promoCode.toUpperCase(),
      input.userId,
      input.email ?? null,
      input.appliedToTier ?? null,
      input.appliedToSku ?? null,
      input.discountAppliedCents,
      input.trialDaysGranted,
      nowSec,
      input.paymentId ?? null,
      input.handoverId ?? null,
      status,
    );

  await db.batch([incrementStmt, insertStmt]);

  return {
    id,
    promo_code_id: input.codeId,
    promo_code: input.promoCode.toUpperCase(),
    user_id: input.userId,
    email: input.email ?? null,
    applied_to_tier: input.appliedToTier ?? null,
    applied_to_sku: input.appliedToSku ?? null,
    discount_applied_cents: input.discountAppliedCents,
    trial_days_granted: input.trialDaysGranted,
    redeemed_at: nowSec,
    payment_id: input.paymentId ?? null,
    handover_id: input.handoverId ?? null,
    status,
  };
}

export async function recordRedemption(input: RecordRedemptionInput): Promise<RedemptionRow> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const id = genId();
  const nowSec = Math.floor(Date.now() / 1000);
  const status = input.status ?? 'redeemed';

  await db
    .prepare(
      `INSERT INTO promo_code_redemptions
       (id, promo_code_id, promo_code, user_id, email, applied_to_tier, applied_to_sku,
        discount_applied_cents, trial_days_granted, redeemed_at, payment_id, handover_id, status)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`,
    )
    .bind(
      id,
      input.promoCodeId,
      input.promoCode.toUpperCase(),
      input.userId,
      input.email ?? null,
      input.appliedToTier ?? null,
      input.appliedToSku ?? null,
      input.discountAppliedCents,
      input.trialDaysGranted,
      nowSec,
      input.paymentId ?? null,
      input.handoverId ?? null,
      status,
    )
    .run();

  return {
    id,
    promo_code_id: input.promoCodeId,
    promo_code: input.promoCode.toUpperCase(),
    user_id: input.userId,
    email: input.email ?? null,
    applied_to_tier: input.appliedToTier ?? null,
    applied_to_sku: input.appliedToSku ?? null,
    discount_applied_cents: input.discountAppliedCents,
    trial_days_granted: input.trialDaysGranted,
    redeemed_at: nowSec,
    payment_id: input.paymentId ?? null,
    handover_id: input.handoverId ?? null,
    status,
  };
}

export async function finalizeRedemption(
  redemptionId: string,
  paymentId: string,
  handoverId?: string,
): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  await db
    .prepare(
      `UPDATE promo_code_redemptions
       SET status='redeemed', payment_id=?2, handover_id=?3
       WHERE id=?1 AND status='reserved'`,
    )
    .bind(redemptionId, paymentId, handoverId ?? null)
    .run();
}
