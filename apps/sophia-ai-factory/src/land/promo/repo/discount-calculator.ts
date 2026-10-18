/**
 * Promo discount redemptions & atomic operations
 * @module land/promo/repo/discount-calculator
 */

import { getD1 } from '@/seed/db/client';
import {
  INCREMENT_PROMO_USED_SQL,
  INSERT_REDEMPTION_SQL,
  FINALIZE_REDEMPTION_SQL,
  buildRedemptionRow,
  type RedemptionRow,
  type IncrementAndRecordInput,
  type RecordRedemptionInput,
} from './types';

function genId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export async function incrementUsedCount(codeId: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  await db.prepare(INCREMENT_PROMO_USED_SQL).bind(codeId).run();
}

export async function incrementAndRecord(input: IncrementAndRecordInput): Promise<RedemptionRow> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const id = genId();
  const nowSec = Math.floor(Date.now() / 1000);
  const status = input.status ?? 'redeemed';
  const row = buildRedemptionRow(id, input.codeId, input, nowSec, status);

  const incrementStmt = db.prepare(INCREMENT_PROMO_USED_SQL).bind(input.codeId);
  const insertStmt = db
    .prepare(INSERT_REDEMPTION_SQL)
    .bind(
      row.id,
      row.promo_code_id,
      row.promo_code,
      row.user_id,
      row.email,
      row.applied_to_tier,
      row.applied_to_sku,
      row.discount_applied_cents,
      row.trial_days_granted,
      row.redeemed_at,
      row.payment_id,
      row.handover_id,
      row.status,
    );

  await db.batch([incrementStmt, insertStmt]);
  return row;
}

export async function recordRedemption(input: RecordRedemptionInput): Promise<RedemptionRow> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const id = genId();
  const nowSec = Math.floor(Date.now() / 1000);
  const status = input.status ?? 'redeemed';
  const row = buildRedemptionRow(id, input.promoCodeId, input, nowSec, status);

  await db
    .prepare(INSERT_REDEMPTION_SQL)
    .bind(
      row.id,
      row.promo_code_id,
      row.promo_code,
      row.user_id,
      row.email,
      row.applied_to_tier,
      row.applied_to_sku,
      row.discount_applied_cents,
      row.trial_days_granted,
      row.redeemed_at,
      row.payment_id,
      row.handover_id,
      row.status,
    )
    .run();

  return row;
}

export async function finalizeRedemption(
  redemptionId: string,
  paymentId: string,
  handoverId?: string,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  await db
    .prepare(FINALIZE_REDEMPTION_SQL)
    .bind(redemptionId, paymentId, handoverId ?? null)
    .run();
}
