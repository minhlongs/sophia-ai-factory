/**
 * MCU (Model Compute Units) Credit Repository
 *
 * Provides atomic balance operations against user_mcu_balance
 * and append-only transaction ledger in mcu_transactions.
 *
 * All mutations are safe for concurrent Workers execution:
 * - deductCredits uses WHERE remaining >= amount guard
 * - addCredits always succeeds (INSERT OR REPLACE + UPDATE)
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export { getBalance, listTransactions, type McuBalance } from './credits-queries';

/**
 * Atomically deduct credits from user balance.
 * Returns false if insufficient credits.
 * Records transaction on success.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  missionId: string,
  reason: string,
): Promise<boolean> {
  if (amount <= 0) return true;

  try {
    const d1 = await getD1();
    if (!d1) throw new Error('D1 database binding not available');

    const stmt = d1.prepare(
      `UPDATE user_mcu_balance
       SET credits_remaining = credits_remaining - ?,
           credits_total_used = credits_total_used + ?,
           updated_at = strftime('%s','now')
       WHERE user_id = ? AND credits_remaining >= ?`
    );
    const result = await stmt.bind(amount, amount, userId, amount).run();

    if (result.meta.changes === 0) {
      logger.debug('[MCU] Insufficient credits or no balance row', { userId, amount });
      return false;
    }

    await d1
      .prepare(
        `INSERT INTO mcu_transactions (user_id, delta, reason, mission_id, metadata)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(userId, -amount, reason, missionId, JSON.stringify({ auto: true }))
      .run();

    return true;
  } catch (err) {
    logger.error('[MCU] deductCredits error', err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

/**
 * Add credits to user balance (for purchases, refunds, monthly resets).
 * Creates balance row if it does not exist.
 */
export async function addCredits(
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  if (amount <= 0) return true;

  try {
    const d1 = await getD1();
    if (!d1) throw new Error('D1 database binding not available');

    await d1
      .prepare(
        `INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, updated_at)
         VALUES (?, ?, ?, strftime('%s','now'))
         ON CONFLICT(user_id) DO UPDATE SET
           credits_remaining = credits_remaining + excluded.credits_remaining,
           credits_total_purchased = credits_total_purchased + excluded.credits_total_purchased,
           updated_at = strftime('%s','now')`
      )
      .bind(userId, amount, amount)
      .run();

    await d1
      .prepare(
        `INSERT INTO mcu_transactions (user_id, delta, reason, metadata)
         VALUES (?, ?, ?, ?)`
      )
      .bind(userId, amount, reason, metadata ? JSON.stringify(metadata) : null)
      .run();
    return true;
  } catch (err) {
    logger.error('[MCU] addCredits error', err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}
