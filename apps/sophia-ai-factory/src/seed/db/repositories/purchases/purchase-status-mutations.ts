/**
 * User Purchases Status and Balance Mutations
 * Layer: SEED (Foundational Primitives)
 */

import { createServerClient, getD1 } from '@/seed/db/client';

/** Mark a purchase as paid and set credits_remaining. Atomic. */
export async function markPaid(
  paymentId: string,
  creditsGranted: number,
  expiresAt?: number | null,
): Promise<void> {
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  await db
    .from('user_purchases')
    .update({
      status: 'paid',
      credits_total: creditsGranted,
      credits_remaining: creditsGranted,
      expires_at: expiresAt ?? null,
      paid_at: now,
      updated_at: now,
    })
    .eq('payment_id', paymentId);
}

/** Mark a purchase as refunded and zero out credits. */
export async function markRefunded(paymentId: string): Promise<void> {
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  await db
    .from('user_purchases')
    .update({
      status: 'refunded',
      credits_remaining: 0,
      refunded_at: now,
      updated_at: now,
    })
    .eq('payment_id', paymentId);
}

/**
 * Atomically decrement credits_remaining by 1 (for 1-credit = 1 video render).
 * Uses a single atomic UPDATE with CAS guard to prevent over-consumption.
 * Returns true if decrement succeeded (credits were available and purchase valid), false otherwise.
 */
export async function decrementCredits(purchaseId: string): Promise<boolean> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .prepare(
      `UPDATE user_purchases
       SET credits_remaining = credits_remaining - 1,
           updated_at = ?2
       WHERE id = ?1
         AND status = 'paid'
         AND credits_remaining > 0
         AND (expires_at IS NULL OR expires_at > ?2)`,
    )
    .bind(purchaseId, now)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}
